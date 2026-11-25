import { describe, expect, it, vi } from 'vitest'
import { projectVoiceTaskSuggestions } from '@/lib/voice-task-suggestion-projection'

describe('Zapis podpowiedzi głosowej', () => {
  it.each([
    { p_segment_id: 'web-general', p_draft_id: null, p_token: 'lease' },
    { p_segment_id: null, p_draft_id: 'web-selected', p_token: 'lease' },
    { p_segment_id: 'device', p_draft_id: null, p_token: 'lease' },
  ])('@REQ: NUR-TASKS-VOICE-COMPLETION stosuje te same reguły dla $p_segment_id $p_draft_id', async (source) => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ id: 'task', title: 'Przewietrzyć świetlicę', updated_at: 'version' }], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
    await projectVoiceTaskSuggestions({ rpc }, source, 'Przewietrzyłam świetlicę.')
    expect(rpc.mock.calls).toEqual([
      ['sync_voice_task_suggestions', { ...source, p_matches: null }],
      ['sync_voice_task_suggestions', { ...source, p_matches: [{
        task_id: 'task', task_updated_at: 'version', fragment_index: 0, kind: 'COMPLETED', quote: 'Przewietrzyłam świetlicę.',
      }] }],
    ])
  })
})
