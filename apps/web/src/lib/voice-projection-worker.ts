import { CAPTURE_SOURCES, OPERATIONAL_REPORT_ENGINE, VOICE_RETENTION } from '@silvercare/contracts/src/generated/voice'
import { createAdminClient } from '@/lib/supabase/admin'
import { redactPrivately, readRedactionUrl, readSpeechConfiguration } from '@/lib/voice-private-speech'
import { redactVoiceTranscript } from '@/lib/voice-redactor'
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

export async function processNextVoiceProjection(config: ReturnType<typeof readSpeechConfiguration>) {
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
      admin.from(OPERATIONAL_REPORT_ENGINE.configResource)
        .select('category_code, category_label, classifier_hint, allowed_sections, is_enabled, archived_at')
        .eq('organization_id', item.organization_id).eq('is_enabled', true).is('archived_at', null),
    ])
    if (transcript.error || !transcript.data || categories.error) throw new Error('VOICE_PROJECTION_SOURCE_UNAVAILABLE')
    const raw = await transcript.data.text()
    const privateText = await redactPrivately(config, raw)
    const sanitized = prepareSanitizedVoiceEvent({
      source: item.source, scope: item.scope, residentId: item.resident_id, transcript: privateText, registry: item.registry,
    })
    const configRows: OperationalReportCategory[] = categories.data.map((category) => ({
      code: category.category_code, label: category.category_label, classifierHint: category.classifier_hint,
      allowedSections: category.allowed_sections as OperationalReportCategory['allowedSections'],
      enabled: category.is_enabled, archivedAt: category.archived_at,
    }))
    const result = await classifySanitizedVoiceEvent(sanitized, configRows, item.registry)
    const response = await admin.rpc('complete_voice_segment_projection', {
      ...lease,
      p_result: {
        behavioral_facts: result.behavioralFacts,
        operational_facts: result.operationalFacts,
        category_codes: result.categoryCodes,
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
