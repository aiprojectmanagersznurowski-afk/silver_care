/**
 * voice-offline-queue.ts — Obsługa kolejki nagrań offline dla asystenta głosowego.
 * Implements: VOICE-OFFLINE (kolejkowanie offline, deduplikacja po client_uuid, sync po powrocie).
 */

export interface OfflineVoiceItem {
  client_uuid: string
  resident_id: string
  audioBlob?: Blob | null
  mimeType?: string
  createdAt: number
  attempts?: number
}

const STORAGE_KEY = 'silvercare_offline_voice_queue_v1'

export function generateClientUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true
}

export function getOfflineVoiceQueue(): OfflineVoiceItem[] {
  if (typeof window === 'undefined' || !window.localStorage) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as OfflineVoiceItem[]) : []
  } catch {
    return []
  }
}

export function saveOfflineVoiceQueue(items: OfflineVoiceItem[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {}
}

export function enqueueOfflineVoiceItem(item: OfflineVoiceItem): OfflineVoiceItem {
  const queue = getOfflineVoiceQueue()
  const existing = queue.find((q) => q.client_uuid === item.client_uuid)
  if (existing) return existing
  const newItem = { ...item, attempts: item.attempts || 0 }
  queue.push(newItem)
  saveOfflineVoiceQueue(queue)
  return newItem
}

export function removeOfflineVoiceItem(client_uuid: string): void {
  const queue = getOfflineVoiceQueue().filter((q) => q.client_uuid !== client_uuid)
  saveOfflineVoiceQueue(queue)
}

export function clearOfflineVoiceQueue(): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

export async function flushOfflineVoiceQueue(
  syncFn?: (item: OfflineVoiceItem) => Promise<boolean>
): Promise<{ synced: number; failed: number }> {
  const queue = getOfflineVoiceQueue()
  if (queue.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0
  const remaining: OfflineVoiceItem[] = []

  for (const item of queue) {
    try {
      const ok = syncFn ? await syncFn(item) : true
      if (ok) {
        synced++
      } else {
        failed++
        remaining.push({ ...item, attempts: (item.attempts || 0) + 1 })
      }
    } catch {
      failed++
      remaining.push({ ...item, attempts: (item.attempts || 0) + 1 })
    }
  }

  saveOfflineVoiceQueue(remaining)
  return { synced, failed }
}
