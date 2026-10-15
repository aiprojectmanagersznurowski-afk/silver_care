import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateClientUuid,
  enqueueOfflineVoiceItem,
  getOfflineVoiceQueue,
  clearOfflineVoiceQueue,
  flushOfflineVoiceQueue,
  removeOfflineVoiceItem,
} from '../../apps/web/src/lib/voice-offline-queue'

describe('VOICE-OFFLINE Logic', () => {

  beforeEach(() => {
    let store: Record<string, string> = {}
    const mockLocalStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = String(val) },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { store = {} },
    }
    // Mock obiektu window i localStorage w środowisku testowym
    if (typeof window === 'undefined') {
      // @ts-expect-error Mocking window in node/vitest
      globalThis.window = {}
    }
    // @ts-expect-error Mocking localStorage
    globalThis.window.localStorage = mockLocalStorage
    clearOfflineVoiceQueue()
  })

  it('generuje poprawny deterministyczny format UUID v4 dla client_uuid @REQ: VOICE-OFFLINE', () => {
    const uuid1 = generateClientUuid()
    const uuid2 = generateClientUuid()

    expect(uuid1).toBeDefined()
    expect(uuid2).toBeDefined()
    expect(uuid1).not.toBe(uuid2)

    // Format UUID v4
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(uuid1).toMatch(uuidV4Regex)
    expect(uuid2).toMatch(uuidV4Regex)
  })

  it('dodaje nagranie z client_uuid do kolejki offline @REQ: VOICE-OFFLINE', () => {
    const clientUuid = generateClientUuid()
    const item = enqueueOfflineVoiceItem({
      client_uuid: clientUuid,
      resident_id: '550e8400-e29b-41d4-a716-446655440000',
      mimeType: 'audio/webm',
      createdAt: Date.now(),
    })

    expect(item.client_uuid).toBe(clientUuid)

    const queue = getOfflineVoiceQueue()
    expect(queue.length).toBe(1)
    expect(queue[0].client_uuid).toBe(clientUuid)
    expect(queue[0].resident_id).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('deduplikuje wpisy po client_uuid zapobiegając powielaniu zadań offline @REQ: VOICE-OFFLINE', () => {
    const clientUuid = generateClientUuid()

    // Pierwsze dodanie
    enqueueOfflineVoiceItem({
      client_uuid: clientUuid,
      resident_id: '550e8400-e29b-41d4-a716-446655440000',
      createdAt: Date.now(),
    })

    // Ponowne dodanie z tym samym client_uuid
    enqueueOfflineVoiceItem({
      client_uuid: clientUuid,
      resident_id: '550e8400-e29b-41d4-a716-446655440000',
      createdAt: Date.now() + 1000,
    })

    const queue = getOfflineVoiceQueue()
    expect(queue.length).toBe(1)
  })

  it('opróżnia kolejkę offline (flush) i synchronizuje nagrania po powrocie sieci @REQ: VOICE-OFFLINE', async () => {
    const uuid1 = generateClientUuid()
    const uuid2 = generateClientUuid()

    enqueueOfflineVoiceItem({ client_uuid: uuid1, resident_id: 'res-1', createdAt: Date.now() })
    enqueueOfflineVoiceItem({ client_uuid: uuid2, resident_id: 'res-2', createdAt: Date.now() })

    expect(getOfflineVoiceQueue().length).toBe(2)

    const syncedItems: string[] = []
    const flushResult = await flushOfflineVoiceQueue(async (item) => {
      syncedItems.push(item.client_uuid)
      return true
    })

    expect(flushResult.synced).toBe(2)
    expect(flushResult.failed).toBe(0)
    expect(syncedItems).toEqual([uuid1, uuid2])

    // Kolejka po pomyślnej synchronizacji jest pusta
    expect(getOfflineVoiceQueue().length).toBe(0)
  })

  it('zachowuje w kolejce elementy, których synchronizacja nie powiodła się @REQ: VOICE-OFFLINE', async () => {
    const uuidOk = generateClientUuid()
    const uuidFail = generateClientUuid()

    enqueueOfflineVoiceItem({ client_uuid: uuidOk, resident_id: 'res-1', createdAt: Date.now() })
    enqueueOfflineVoiceItem({ client_uuid: uuidFail, resident_id: 'res-2', createdAt: Date.now() })

    const flushResult = await flushOfflineVoiceQueue(async (item) => {
      if (item.client_uuid === uuidFail) return false
      return true
    })

    expect(flushResult.synced).toBe(1)
    expect(flushResult.failed).toBe(1)

    const remaining = getOfflineVoiceQueue()
    expect(remaining.length).toBe(1)
    expect(remaining[0].client_uuid).toBe(uuidFail)
    expect(remaining[0].attempts).toBe(1)

    // Ręczne usunięcie
    removeOfflineVoiceItem(uuidFail)
    expect(getOfflineVoiceQueue().length).toBe(0)
  })

})
