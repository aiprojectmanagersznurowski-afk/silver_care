import { createHash } from 'node:crypto'
import { VOICE_RETENTION } from '@silvercare/contracts/src/generated/voice'
import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/lib/supabase/admin'
import { assignVoiceSegment, type AssignmentResident, type SegmentAssignment } from '@/lib/voice-segment-assignment'
import { findDeclaredVoiceAuthor, readPrivateSpeech, readSpeechConfiguration, type PrivateSpeechSegment, type VoiceStaffIdentity } from '@/lib/voice-private-speech'

type Capture = Database['public']['Tables']['voice_captures']['Row']
type CaptureIdentity = Pick<Capture, 'source' | 'author_id' | 'clock_state' | 'session_seq' | 'selected_resident_id'>
type Registry = { residents: AssignmentResident[]; staff: VoiceStaffIdentity[]; declared_author_id: string | null }
type SpeechConfig = ReturnType<typeof readSpeechConfiguration>
const maxStoredAudioBytes = 25 * 1024 * 1024

function onlyIntroduction(text: string) {
  return text.replace(/[.!?;\n]+$/u, '').split(/[.!?;\n]+/u).length === 1
}

function safelyAttributed(
  assignment: SegmentAssignment, conflict: boolean,
): SegmentAssignment {
  if (!conflict || assignment.scope !== 'PENDING') return assignment
  const reasons = [...new Set(['CONFLICTING_EVIDENCE' as const, ...assignment.reasons])]
  return { ...assignment, reasons }
}

export function planCaptureSegments(capture: CaptureIdentity, registry: Registry, clips: PrivateSpeechSegment[]) {
  const isDevice = capture.source === 'DEVICE'
  const firstIntroduction = isDevice ? findDeclaredVoiceAuthor(clips[0]?.text ?? '', registry.staff) : null
  const declaration = capture.session_seq === 1 ? firstIntroduction : null
  const sessionAuthor = capture.author_id ?? declaration ?? registry.declared_author_id
  let authorConflict = false
  const segments = clips.flatMap(({ text, start_ms, end_ms }, ordinal) => {
    if (ordinal === 0 && declaration && onlyIntroduction(text)) return []
    const spokenAuthor = isDevice ? findDeclaredVoiceAuthor(text, registry.staff) : null
    if (spokenAuthor && spokenAuthor !== sessionAuthor) authorConflict = true
    const author_id = authorConflict ? null : sessionAuthor
    const assignment = safelyAttributed(assignVoiceSegment({
      text, authorId: author_id, timeCertain: capture.clock_state !== 'UNKNOWN',
      selectedResidentId: capture.selected_resident_id ?? undefined,
    }, registry.residents), authorConflict)
    return [{
      text, ordinal, start_ms, end_ms, author_id, scope: assignment.scope,
      resident_id: assignment.scope === 'RESIDENT' ? assignment.residentId : null,
      reasons: assignment.scope === 'PENDING' ? assignment.reasons : [],
      candidate_ids: assignment.scope === 'PENDING' ? assignment.candidateIds : [],
    }]
  })
  return { declaration, segments }
}

export async function processNextVoiceCapture(config: SpeechConfig) {
  const admin = createAdminClient()
  const { data: claims, error: claimError } = await admin.rpc('claim_voice_capture')
  if (claimError) throw new Error('VOICE_CLAIM_FAILED')
  const capture = claims?.[0]
  if (!capture?.processing_token) return 'idle'
  const lease = { p_capture_id: capture.id, p_token: capture.processing_token }
  const bucket = admin.storage.from(VOICE_RETENTION.storageBucket)
  const storedPaths: string[] = []
  let permanentError = false
  let finalizing = false
  try {
    const source = await bucket.download(capture.storage_path)
    if (source.error || !source.data) throw new Error('VOICE_STORAGE_UNAVAILABLE')
    if (!source.data.size || source.data.size > maxStoredAudioBytes
      || createHash('sha256').update(new Uint8Array(await source.data.arrayBuffer())).digest('hex') !== capture.sha256) {
      permanentError = true
      throw new Error('VOICE_AUDIO_INTEGRITY')
    }

    const context = await admin.rpc('read_voice_capture_context', lease)
    if (context.error || !context.data) throw new Error('VOICE_CONTEXT_UNAVAILABLE')
    const clips = await readPrivateSpeech(config, source.data)
    const plan = planCaptureSegments(capture, context.data as unknown as Registry, clips)
    if (plan.declaration) {
      const declaration = await admin.rpc('declare_voice_capture_author', { ...lease, p_author_id: plan.declaration })
      if (declaration.error) throw new Error('VOICE_DECLARATION_FAILED')
    }

    const prepared = []
    for (const { text, ...segment } of plan.segments) {
      const path = `${capture.organization_id}/transcripts/${capture.id}/${lease.p_token}/${segment.ordinal}`
      storedPaths.push(path)
      const uploaded = await bucket.upload(path, new Blob([text], { type: 'text/plain; charset=utf-8' }), {
        contentType: 'text/plain; charset=utf-8', upsert: false,
      })
      if (uploaded.error) throw new Error('VOICE_TRANSCRIPT_STORAGE_FAILED')
      prepared.push({ ...segment, transcript_path: path })
    }
    finalizing = true
    const result = await admin.rpc('finalize_voice_capture', { ...lease, p_segments: prepared })
    if (result.error) throw new Error('VOICE_FINALIZE_FAILED')
    return 'processed'
  } catch {
    // Po utracie odpowiedzi z finalizacji zapis mógł się powieść.
    if (!finalizing && storedPaths.length) await bucket.remove(storedPaths)
    const released = await admin.rpc('complete_voice_capture_failure', { ...lease, p_retry: !permanentError })
    if (released.error) throw new Error('VOICE_RELEASE_FAILED')
    return 'failed'
  }
}
