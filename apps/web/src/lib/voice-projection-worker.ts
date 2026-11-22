import { CAPTURE_SOURCES, OPERATIONAL_REPORT_ENGINE, VOICE_RETENTION } from '@silvercare/contracts/src/generated/voice'
import { createAdminClient } from '@/lib/supabase/admin'
import { redactPrivately, readRedactionUrl, readSpeechConfiguration } from '@/lib/voice-private-speech'
import { redactVoiceTranscript } from '@/lib/voice-redactor'
import { extractNextShiftTaskIntents } from '@/lib/voice-shift-task-intent'
import { assignVoiceSegment, type AssignmentResident } from '@/lib/voice-segment-assignment'
import { classifySanitizedVoiceEvent, prepareSanitizedVoiceEvent, type OperationalReportCategory, type VoiceReportRegistry } from '@/lib/voice-report-engine'

interface ProjectionClaim {
  token: string
  organization_id: string
  segment_id: string
  resident_id: string | null
  source: (typeof CAPTURE_SOURCES)[number]['id']
  scope: 'resident' | 'facility'
  transcript_path: string
  registry: VoiceReportRegistry
}

type AdminClient = ReturnType<typeof createAdminClient>
type SpeechConfig = ReturnType<typeof readSpeechConfiguration>

async function loadCategories(admin: AdminClient, organizationId: string): Promise<OperationalReportCategory[]> {
  const { data, error } = await admin.from(OPERATIONAL_REPORT_ENGINE.configResource)
    .select('category_code, category_label, classifier_hint, allowed_sections, is_enabled, archived_at')
    .eq('organization_id', organizationId).eq('is_enabled', true).is('archived_at', null)
  if (error) throw new Error('VOICE_REPORT_CATEGORIES_UNAVAILABLE')
  return data.map((category) => ({
    code: category.category_code, label: category.category_label, classifierHint: category.classifier_hint,
    allowedSections: category.allowed_sections as OperationalReportCategory['allowedSections'],
    enabled: category.is_enabled, archivedAt: category.archived_at,
  }))
}

export async function processNextVoiceProjection(config: SpeechConfig) {
  readRedactionUrl(config)
  const admin = createAdminClient()
  const claim = await admin.rpc('claim_voice_segment_projection')
  if (claim.error) throw new Error('VOICE_PROJECTION_CLAIM_FAILED')
  if (!claim.data) return 'idle'
  const item = claim.data as unknown as ProjectionClaim
  const lease = { p_segment_id: item.segment_id, p_token: item.token }

  try {
    const [transcript, categories] = await Promise.all([
      admin.storage.from(VOICE_RETENTION.storageBucket).download(item.transcript_path),
      loadCategories(admin, item.organization_id),
    ])
    if (transcript.error || !transcript.data) throw new Error('VOICE_PROJECTION_SOURCE_UNAVAILABLE')
    const raw = await transcript.data.text()
    const privateText = await redactPrivately(config, raw)
    const sanitized = prepareSanitizedVoiceEvent({
      source: item.source, scope: item.scope, residentId: item.resident_id, transcript: privateText, registry: item.registry,
    })
    const result = await classifySanitizedVoiceEvent(sanitized, categories, item.registry)
    const proposedTasks = extractNextShiftTaskIntents(sanitized.sanitizedTranscript)
    const familyFacts = result.behavioralFacts.filter((fact) => !proposedTasks.some(
      ({ title, quote }) => quote.includes(fact) || fact.includes(title),
    ))
    const response = await admin.rpc('complete_voice_segment_projection', {
      ...lease,
      p_result: {
        behavioral_facts: familyFacts,
        operational_facts: result.operationalFacts,
        category_codes: result.categoryCodes,
        proposed_tasks: proposedTasks,
        restricted_medical: item.scope === 'resident' ? redactVoiceTranscript(raw).extractedMedical : [],
      },
    })
    if (response.error) throw new Error('VOICE_PROJECTION_WRITE_FAILED')
    return response.data ? 'processed' : 'idle'
  } catch {
    const response = await admin.rpc('complete_voice_segment_projection', { ...lease, p_result: null })
    if (response.error) throw new Error('VOICE_PROJECTION_RELEASE_FAILED')
    return 'failed'
  }
}

interface SelectedWebClaim {
  token: string
  draft_id: string
  organization_id: string
  resident_id: string
  author_id: string
  transcript: string
  residents: AssignmentResident[]
  staff_names: string[]
}

async function classifySelectedVoiceDraft(admin: AdminClient, config: SpeechConfig, item: SelectedWebClaim) {
  const assigned = assignVoiceSegment({
    text: item.transcript, authorId: item.author_id, timeCertain: true, selectedResidentId: item.resident_id,
  }, item.residents)
  if (assigned.scope !== 'RESIDENT' || item.transcript.length > 12_000) {
    return { operational_facts: [], category_codes: [] }
  }
  const registry = {
    residentNames: [...item.staff_names, ...item.residents.map(({ firstName, lastName }) => `${firstName} ${lastName}`)],
    rooms: item.residents.flatMap(({ room }) => room ? [room] : []),
    beds: item.residents.flatMap(({ bed }) => bed ? [bed] : []),
  }
  const [redacted, categories] = await Promise.all([
    redactPrivately(config, item.transcript), loadCategories(admin, item.organization_id),
  ])
  const sanitized = prepareSanitizedVoiceEvent({
    source: 'APP', scope: 'resident', residentId: item.resident_id, transcript: redacted, registry,
  })
  const classification = await classifySanitizedVoiceEvent(sanitized, categories, registry)
  return { operational_facts: classification.operationalFacts, category_codes: classification.categoryCodes }
}

export async function processNextSelectedVoiceOperationalReport(config: SpeechConfig) {
  readRedactionUrl(config)
  const admin = createAdminClient()
  const claim = await admin.rpc('claim_processed_app_voice_draft')
  if (claim.error) throw new Error('APP_VOICE_REPORT_CLAIM_FAILED')
  if (!claim.data) return 'idle'
  const item = claim.data as unknown as SelectedWebClaim
  const lease = { p_draft_id: item.draft_id, p_token: item.token }
  try {
    const details = await classifySelectedVoiceDraft(admin, config, item)
    const result = await admin.rpc('complete_processed_app_voice_draft', { ...lease, p_result: details })
    if (result.error) throw new Error('APP_VOICE_REPORT_WRITE_FAILED')
    return result.data ? 'processed' : 'idle'
  } catch {
    const released = await admin.rpc('complete_processed_app_voice_draft', { ...lease, p_result: null })
    if (released.error) throw new Error('APP_VOICE_REPORT_RELEASE_FAILED')
    return 'failed'
  }
}
