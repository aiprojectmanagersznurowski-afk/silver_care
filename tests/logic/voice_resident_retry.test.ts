import { afterEach, expect, it, vi } from 'vitest'
import {
  clearOfflineVoiceQueue, enqueueOfflineVoiceItem, flushOfflineVoiceQueue, getOfflineVoiceQueue,
  getOfflineQueueStats,
} from '../../apps/web/src/lib/voice-offline-queue'

const author = 'test-author'
const item = {
  client_uuid: 'fixed-capture-id', resident_id: 'test-resident', author_id: author,
  audioBlob: new Blob(['test-audio'], { type: 'audio/webm' }),
  purpose: 'resident_capture' as const,
}

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await clearOfflineVoiceQueue()
})

it('wydłuża odstęp po awarii i zachowuje nagranie po czterech błędach 503 @REQ: VOICE-OFFLINE', async () => {
  let now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const post = vi.fn(async () => Response.json({}, { status: 503 }))
  vi.stubGlobal('fetch', post)
  await enqueueOfflineVoiceItem({ ...item, createdAt: now })
  const attempt = () => flushOfflineVoiceQueue(undefined, { authorId: author, mode: 'scheduled' })
  for (const delay of [5000, 10_000, 20_000, 40_000]) {
    expect((await getOfflineQueueStats(author)).nextResidentRetryAt).toBe(now + delay)
    await attempt()
    now += delay
    await attempt()
  }
  expect(post).toHaveBeenCalledTimes(4)
  expect(await getOfflineVoiceQueue()).toEqual([
    expect.objectContaining({ ...item, attempts: 4, status: 'pending', nextAttemptAt: now + 80_000 }),
  ])
})

it('wznawia zablokowane nagranie ręcznie tylko w sesji autora @REQ: VOICE-OFFLINE', async () => {
  const post = vi.fn(async (_url: string, _request: RequestInit) => Response.json({ success: true }))
  vi.stubGlobal('fetch', post)
  await enqueueOfflineVoiceItem({ ...item, createdAt: Date.now(), status: 'failed_permanent', attempts: 3 })
  await flushOfflineVoiceQueue(undefined, { authorId: 'different-author', mode: 'manual' })
  await flushOfflineVoiceQueue(undefined, { authorId: author })
  expect(post).not.toHaveBeenCalled()

  expect((await getOfflineQueueStats(author)).blockedResidentCaptureCount).toBe(1)
  expect(await flushOfflineVoiceQueue(undefined, { authorId: author, mode: 'manual' }))
    .toEqual({ synced: 1, failed: 0 })
  const body = post.mock.calls[0][1].body as FormData
  expect(body.get('client_uuid')).toBe(item.client_uuid)
  expect(body.get('resident_id')).toBe(item.resident_id)
  expect(body.get('author_id')).toBe(author)
  expect(await getOfflineVoiceQueue()).toHaveLength(0)
})
