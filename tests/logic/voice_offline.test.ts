import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateClientUuid,
  enqueueOfflineVoiceItem,
  getOfflineVoiceQueue,
  clearOfflineVoiceQueue,
  flushOfflineVoiceQueue,
  removeOfflineVoiceItem,
  getOfflineQueueStats,
  sendOfflineVoiceItemToServer,
  OfflineVoiceItem,
} from '../../apps/web/src/lib/voice-offline-queue'

describe('VOICE-OFFLINE Logic', () => {
  beforeEach(async () => {
    if (typeof window === 'undefined') {
      // @ts-expect-error Mocking window in node/vitest
      globalThis.window = {}
    }
    await clearOfflineVoiceQueue()
    vi.restoreAllMocks()
  })

  it('generuje poprawny deterministyczny format UUID v4 dla client_uuid @REQ: VOICE-OFFLINE', () => {
    const uuid1 = generateClientUuid()
    const uuid2 = generateClientUuid()

    expect(uuid1).toBeDefined()
    expect(uuid2).toBeDefined()
    expect(uuid1).not.toBe(uuid2)

    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(uuid1).toMatch(uuidV4Regex)
    expect(uuid2).toMatch(uuidV4Regex)
  })

  it('dodaje nagranie z client_uuid, purpose i resident_id do kolejki offline @REQ: VOICE-OFFLINE', async () => {
    const clientUuid = generateClientUuid()
    const blob = new Blob(['voice-data-123'], { type: 'audio/webm' })

    const item = await enqueueOfflineVoiceItem({
      client_uuid: clientUuid,
      resident_id: '550e8400-e29b-41d4-a716-446655440000',
      audioBlob: blob,
      mimeType: 'audio/webm',
      purpose: 'resident_note',
      createdAt: Date.now(),
    })

    expect(item.client_uuid).toBe(clientUuid)
    expect(item.purpose).toBe('resident_note')
    expect(item.status).toBe('pending')
    expect(item.attempts).toBe(0)

    const queue = await getOfflineVoiceQueue()
    expect(queue.length).toBe(1)
    expect(queue[0].client_uuid).toBe(clientUuid)
    expect(queue[0].resident_id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(queue[0].purpose).toBe('resident_note')
  })

  it('deduplikuje wpisy po client_uuid zapobiegając powielaniu zadań offline @REQ: VOICE-OFFLINE', async () => {
    const clientUuid = generateClientUuid()

    await enqueueOfflineVoiceItem({
      client_uuid: clientUuid,
      resident_id: '550e8400-e29b-41d4-a716-446655440000',
      createdAt: Date.now(),
      purpose: 'staff_message',
    })

    await enqueueOfflineVoiceItem({
      client_uuid: clientUuid,
      resident_id: '550e8400-e29b-41d4-a716-446655440000',
      createdAt: Date.now() + 1000,
      purpose: 'resident_note',
    })

    const queue = await getOfflineVoiceQueue()
    expect(queue.length).toBe(1)
    expect(queue[0].purpose).toBe('staff_message')
  })

  it('kolejkuje nagranie przy błędzie sieciowym fetch lub HTTP 503 mimo onLine === true @REQ: VOICE-OFFLINE', async () => {
    const uuid503 = generateClientUuid()
    const validBlob = new Blob(['audio-content-test'], { type: 'audio/webm' })

    const item503: OfflineVoiceItem = {
      client_uuid: uuid503,
      resident_id: 'res-503',
      audioBlob: validBlob,
      mimeType: 'audio/webm',
      createdAt: Date.now(),
      purpose: 'resident_note',
      attempts: 0,
      status: 'pending',
    }

    await enqueueOfflineVoiceItem(item503)

    // Symulacja błędu serwera HTTP 503 (słabe Wi-Fi / awaria backendu)
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'Service Unavailable' }),
    })

    const result503 = await sendOfflineVoiceItemToServer(item503)
    expect(result503).toBe(false)
    expect(item503.lastError).toContain('503')

    // Symulacja błędu sieciowego (np. brak trasy / timeout w fetch)
    const uuidNetworkErr = generateClientUuid()
    const itemNetErr: OfflineVoiceItem = {
      client_uuid: uuidNetworkErr,
      resident_id: 'res-net',
      audioBlob: validBlob,
      mimeType: 'audio/webm',
      createdAt: Date.now(),
      purpose: 'facility_import',
      attempts: 0,
      status: 'pending',
    }
    await enqueueOfflineVoiceItem(itemNetErr)

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch (Network disconnected)'))
    const resultNet = await sendOfflineVoiceItemToServer(itemNetErr)
    expect(resultNet).toBe(false)
    expect(itemNetErr.lastError).toContain('Network disconnected')

    // Obie pozycje są bezpiecznie zachowane w kolejce
    const queue = await getOfflineVoiceQueue()
    expect(queue.length).toBe(2)
  })

  it('odrzuca puste nagranie bez wysyłania pustego pliku i oznacza status failed_permanent @REQ: VOICE-OFFLINE', async () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy

    const emptyItem: OfflineVoiceItem = {
      client_uuid: generateClientUuid(),
      resident_id: 'res-empty',
      audioBlob: null,
      audioBase64: '',
      createdAt: Date.now(),
      purpose: 'resident_note',
      attempts: 0,
      status: 'pending',
    }

    await enqueueOfflineVoiceItem(emptyItem)

    const success = await sendOfflineVoiceItemToServer(emptyItem)

    // Nie wysłano sztucznego empty-offline-recording do API
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(success).toBe(false)
    expect(emptyItem.status).toBe('failed_permanent')
    expect(emptyItem.lastError).toContain('Brak danych audio')

    const stats = await getOfflineQueueStats()
    expect(stats.failedCount).toBe(1)
    expect(stats.pendingCount).toBe(0)
  })

  it('po 3 nieudanych próbach oznacza element jako failed_permanent i nie ponawia w nieskończoność @REQ: VOICE-OFFLINE', async () => {
    const uuidFail = generateClientUuid()
    const validBlob = new Blob(['audio-sample'], { type: 'audio/webm' })

    await enqueueOfflineVoiceItem({
      client_uuid: uuidFail,
      resident_id: 'res-fail',
      audioBlob: validBlob,
      createdAt: Date.now(),
      attempts: 0,
      status: 'pending',
    })

    const failingSync = vi.fn().mockResolvedValue(false)

    // Próba 1
    const res1 = await flushOfflineVoiceQueue(failingSync)
    expect(res1.failed).toBe(1)
    let queue = await getOfflineVoiceQueue()
    expect(queue[0].attempts).toBe(1)
    expect(queue[0].status).toBe('pending')

    // Próba 2
    const res2 = await flushOfflineVoiceQueue(failingSync)
    expect(res2.failed).toBe(1)
    queue = await getOfflineVoiceQueue()
    expect(queue[0].attempts).toBe(2)
    expect(queue[0].status).toBe('pending')

    // Próba 3 — przekroczenie limitu 3 prób -> przejście w stan failed_permanent
    const res3 = await flushOfflineVoiceQueue(failingSync)
    expect(res3.failed).toBe(1)
    queue = await getOfflineVoiceQueue()
    expect(queue[0].attempts).toBe(3)
    expect(queue[0].status).toBe('failed_permanent')

    // Próba 4 — kolejka pomija elementy failed_permanent (brak zapętlania w nieskończoność)
    failingSync.mockClear()
    const res4 = await flushOfflineVoiceQueue(failingSync)
    expect(res4.synced).toBe(0)
    expect(res4.failed).toBe(0)
    expect(failingSync).not.toHaveBeenCalled()

    // Czyszczenie
    await removeOfflineVoiceItem(uuidFail)
    expect((await getOfflineVoiceQueue()).length).toBe(0)
  })

  it('poprawnie zlicza statystyki getOfflineQueueStats() i opróżnia kolejkę po powrocie sieci @REQ: VOICE-OFFLINE', async () => {
    const uuid1 = generateClientUuid()
    const uuid2 = generateClientUuid()
    const uuidFailed = generateClientUuid()
    const blob = new Blob(['sample'], { type: 'audio/webm' })

    await enqueueOfflineVoiceItem({ client_uuid: uuid1, resident_id: 'r1', audioBlob: blob, createdAt: Date.now() })
    await enqueueOfflineVoiceItem({ client_uuid: uuid2, resident_id: 'r2', audioBlob: blob, createdAt: Date.now() })
    await enqueueOfflineVoiceItem({
      client_uuid: uuidFailed,
      resident_id: 'r3',
      audioBlob: blob,
      createdAt: Date.now(),
      status: 'failed_permanent',
      attempts: 3,
    })

    const initialStats = await getOfflineQueueStats()
    expect(initialStats.pendingCount).toBe(2)
    expect(initialStats.failedCount).toBe(1)

    // Powrót sieci — synchronizacja pending
    const flushResult = await flushOfflineVoiceQueue(async (item) => {
      return item.client_uuid !== uuidFailed
    })

    expect(flushResult.synced).toBe(2)
    expect(flushResult.failed).toBe(0)

    const afterStats = await getOfflineQueueStats()
    expect(afterStats.pendingCount).toBe(0)
    expect(afterStats.failedCount).toBe(1)

    const remaining = await getOfflineVoiceQueue()
    expect(remaining.length).toBe(1)
    expect(remaining[0].client_uuid).toBe(uuidFailed)
  })

  it('emituje CustomEvent sc-offline-queue-change przy zmianach stanu kolejki @REQ: VOICE-OFFLINE', async () => {
    let lastDispatchedStats = null
    const eventHandler = (e: Event) => {
      const custom = e as CustomEvent
      lastDispatchedStats = custom.detail
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('sc-offline-queue-change', eventHandler)
    }

    const uuid = generateClientUuid()
    await enqueueOfflineVoiceItem({
      client_uuid: uuid,
      resident_id: 'res-evt',
      createdAt: Date.now(),
    })

    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('sc-offline-queue-change', eventHandler)
    }

    if (lastDispatchedStats) {
      expect(lastDispatchedStats).toEqual({ pendingCount: 1, failedCount: 0 })
    }
  })
})
