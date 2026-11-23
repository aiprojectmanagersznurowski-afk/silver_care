import type { createAdminClient } from '@/lib/supabase/admin'
import { matchVoiceTaskCompletion } from '@/lib/voice-shift-task-completion'

type AdminClient = Pick<ReturnType<typeof createAdminClient>, 'rpc'>
type SourceLease = { p_segment_id: string | null; p_draft_id: string | null; p_token: string }
type Candidate = { id: string; title: string; updated_at: string }

export async function projectVoiceTaskSuggestions(admin: AdminClient, source: SourceLease, sanitizedText: string) {
  if (!sanitizedText) return
  const candidates = await admin.rpc('sync_voice_task_suggestions', { ...source, p_matches: null })
  if (candidates.error || !Array.isArray(candidates.data)) throw new Error('VOICE_TASK_CANDIDATES_UNAVAILABLE')
  const rows = candidates.data as Candidate[]
  const versions = new Map(rows.map(({ id, updated_at }) => [id, updated_at]))
  const matches = matchVoiceTaskCompletion(sanitizedText, rows).map(({ taskId, fragmentIndex, kind, quote }) => ({
    task_id: taskId, task_updated_at: versions.get(taskId), fragment_index: fragmentIndex, kind, quote,
  }))
  if (!matches.length) return
  const write = await admin.rpc('sync_voice_task_suggestions', { ...source, p_matches: matches })
  if (write.error) throw new Error('VOICE_TASK_EVIDENCE_WRITE_FAILED')
}
