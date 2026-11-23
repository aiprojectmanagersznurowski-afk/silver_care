import { VOICE_RETENTION } from '@silvercare/contracts/src/generated/voice'
import { createAdminClient } from '@/lib/supabase/admin'
import { clipVoiceAudio, VoiceAudioUnavailable } from '@/lib/voice-audio-clip'
import { readPrivateSpeech, type readSpeechConfiguration } from '@/lib/voice-private-speech'
import { assignVoiceSegment, type AssignmentResident } from '@/lib/voice-segment-assignment'

interface PartClaim {
  segment_id: string
  capture_id: string
  organization_id: string
  storage_path: string
  sha256: string
  token: string
  start_ms: number
  end_ms: number
  time_certain: boolean
  author_id: string | null
  residents: AssignmentResident[]
}

export async function processNextVoiceAssignmentPart(config: ReturnType<typeof readSpeechConfiguration>) {
  const admin = createAdminClient()
  const claim = await admin.rpc('claim_voice_segment_transcription')
  if (claim.error) throw new Error('VOICE_TRANSCRIPTION_CLAIM_FAILED')
  if (!claim.data) return 'idle'
  const part = claim.data as unknown as PartClaim
  const lease = { p_segment_id: part.segment_id, p_token: part.token }
  const bucket = admin.storage.from(VOICE_RETENTION.storageBucket)
  let attemptedPath: string | undefined
  let finalizing = false
  try {
    const source = await bucket.download(part.storage_path)
    if (!source.data) {
      const exists = await bucket.exists(part.storage_path)
      if (!exists.error && !exists.data) throw new VoiceAudioUnavailable()
      throw new Error('VOICE_STORAGE_UNAVAILABLE')
    }
    const audio = await clipVoiceAudio(source.data, part.sha256, part.start_ms, part.end_ms)
    const clips = await readPrivateSpeech(config, audio)
    const text = clips.map((clip) => clip.text).join('\n')
    if (!text) throw new VoiceAudioUnavailable()
    const assignment = assignVoiceSegment({
      text, authorId: part.author_id, timeCertain: part.time_certain,
    }, part.residents)
    const path = `${part.organization_id}/transcripts/${part.capture_id}/${part.segment_id}/${part.token}`
    attemptedPath = path
    const saved = await bucket.upload(path, new Blob([text], { type: 'text/plain; charset=utf-8' }), { upsert: false })
    if (saved.error) throw new Error('VOICE_TRANSCRIPT_STORAGE_FAILED')

    finalizing = true
    const finished = await admin.rpc('finish_voice_segment_transcription', {
      ...lease,
      p_result: {
        transcript_path: path,
        scope: assignment.scope,
        resident_id: assignment.scope === 'RESIDENT' ? assignment.residentId : null,
        reasons: assignment.scope === 'PENDING' ? assignment.reasons : [],
        candidate_ids: assignment.scope === 'PENDING' ? assignment.candidateIds : [],
      },
    })
    if (finished.error) throw new Error('VOICE_TRANSCRIPTION_WRITE_FAILED')
    if (!finished.data) await bucket.remove([path])
    return finished.data ? 'processed' : 'idle'
  } catch (error) {
    // Po utracie odpowiedzi zapis mógł się powieść. Sprzątanie źródła obejmuje także ścieżki ponowień.
    if (attemptedPath && !finalizing) await bucket.remove([attemptedPath])
    const released = await admin.rpc('finish_voice_segment_transcription', {
      ...lease, p_unavailable: error instanceof VoiceAudioUnavailable,
    })
    if (released.error) throw new Error('VOICE_TRANSCRIPTION_RELEASE_FAILED')
    return released.data ? 'failed' : 'idle'
  }
}
