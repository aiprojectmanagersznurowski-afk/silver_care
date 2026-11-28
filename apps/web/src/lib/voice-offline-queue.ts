/**
 * voice-offline-queue.ts — Obsługa kolejki nagrań offline dla asystenta głosowego.
 * Implements: VOICE-OFFLINE (kolejkowanie IndexedDB, deduplikacja po client_uuid, ponawianie zależne od celu zapisu).
 */

import {
  StoredVoiceItem,
  type VoiceQueuePurpose,
  idbPutItem,
  idbGetItem,
  idbGetAllItems,
  idbDeleteItem,
  idbClearAll,
  base64ToBlob,
  blobToBase64,
} from './voice-idb-store'

export { base64ToBlob, blobToBase64 }

export type { VoiceQueuePurpose }
export type VoiceQueueStatus = 'pending' | 'failed_permanent'
export type VoiceSyncMode = 'scheduled' | 'manual'
export type ResidentCaptureSyncState = { clientUuid: string; status: 'submitted' | 'blocked' }

const firstRetryDelayMs = 5_000
export const residentCaptureTimeoutMs = 30_000
export const isTransientCaptureStatus = (status: number) => status >= 500 || status === 408 || status === 429

export interface OfflineVoiceItem {
  client_uuid: string
  resident_id: string
  audioBlob?: Blob | null
  audioBase64?: string
  mimeType?: string
  ext?: string
  purpose?: VoiceQueuePurpose
  author_id?: string
  createdAt: number
  attempts?: number
  nextAttemptAt?: number
  status?: VoiceQueueStatus
  lastError?: string
}

export interface VoiceQueueStats {
  pendingCount: number
  failedCount: number
  blockedResidentCaptureCount: number
  nextResidentRetryAt: number | null
}

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
  return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
    ? navigator.onLine
    : true
}

const belongsToSession = (item: OfflineVoiceItem, authorId?: string) =>
  !authorId || item.author_id === authorId || (!item.author_id && item.purpose !== 'resident_capture')

export async function getOfflineQueueStats(authorId?: string): Promise<VoiceQueueStats> {
  const queue = await idbGetAllItems()
  const stats: VoiceQueueStats = { pendingCount: 0, failedCount: 0, blockedResidentCaptureCount: 0, nextResidentRetryAt: null }
  for (const item of queue) {
    if (!belongsToSession(item, authorId)) continue
    if (item.status === 'failed_permanent') {
      stats.failedCount++
      if (item.purpose === 'resident_capture') stats.blockedResidentCaptureCount++
    } else {
      stats.pendingCount++
      if (item.purpose === 'resident_capture') {
        stats.nextResidentRetryAt = Math.min(stats.nextResidentRetryAt ?? Infinity, item.nextAttemptAt ?? Date.now())
      }
    }
  }
  return stats
}

export async function notifyOfflineQueueChange(stats?: VoiceQueueStats): Promise<VoiceQueueStats> {
  const currentStats = stats || (await getOfflineQueueStats())
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(
        new CustomEvent('sc-offline-queue-change', { detail: currentStats })
      )
    } catch {}
  }
  return currentStats
}

export async function getOfflineVoiceQueue(): Promise<OfflineVoiceItem[]> {
  return idbGetAllItems()
}

export async function enqueueOfflineVoiceItem(item: OfflineVoiceItem): Promise<OfflineVoiceItem> {
  const existing = await idbGetItem(item.client_uuid)
  if (existing) return existing

  const newItem: StoredVoiceItem = {
    ...item,
    purpose: item.purpose || 'resident_note',
    createdAt: item.createdAt || Date.now(),
    attempts: item.attempts || 0,
    nextAttemptAt: item.nextAttemptAt ?? (item.purpose === 'resident_capture' ? Date.now() + firstRetryDelayMs : undefined),
    status: item.status || 'pending',
  }

  await idbPutItem(newItem)
  await notifyOfflineQueueChange()
  return newItem
}

export async function removeOfflineVoiceItem(client_uuid: string): Promise<void> {
  await idbDeleteItem(client_uuid)
  await notifyOfflineQueueChange()
}

export async function clearOfflineVoiceQueue(): Promise<void> {
  await idbClearAll()
  await notifyOfflineQueueChange()
}

export async function sendOfflineVoiceItemToServer(item: OfflineVoiceItem): Promise<boolean> {
  const mime = item.mimeType || 'audio/webm'
  const base64 = item.audioBase64?.trim()
  const blob = item.audioBlob ?? (base64 ? base64ToBlob(base64, mime) : null)
  if (!blob?.size) {
    item.status = 'failed_permanent'
    item.lastError = base64 ? 'Nie udało się odtworzyć danych audio.' : 'Brak danych audio w elemencie kolejki.'
    await idbPutItem(item as StoredVoiceItem)
    await notifyOfflineQueueChange()
    return false
  }

  try {
    const formData = new FormData()
    formData.append('client_uuid', item.client_uuid)
    if (item.resident_id) formData.append('resident_id', item.resident_id)
    formData.append('purpose', item.purpose || 'resident_note')
    const residentCapture = item.purpose === 'resident_capture'
    const privateCapture = item.purpose === 'general_note' || residentCapture
    if (privateCapture) {
      if (!item.author_id) return false
      formData.append('author_id', item.author_id)
    }
    formData.append('recorded_at', new Date(item.createdAt).toISOString())

    const ext = item.ext || (mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : 'webm')
    formData.append('file', blob, `offline-${item.client_uuid}.${ext}`)

    const res = await fetch(privateCapture ? '/api/voice/captures' : '/api/voice/transcribe', {
      method: 'POST',
      body: formData,
      signal: residentCapture ? AbortSignal.timeout?.(residentCaptureTimeoutMs) : undefined,
    })

    if (!res.ok) {
      if (residentCapture && res.status >= 400 && res.status < 500 && !isTransientCaptureStatus(res.status)) {
        item.status = 'failed_permanent'
      }
      item.lastError = `Błąd HTTP serwera: ${res.status}`
      return false
    }
    const data = await res.json().catch(() => ({}))
    if (!data.success) {
      item.lastError = data.error || 'Błąd transkrypcji na serwerze'
      return false
    }
    return true
  } catch (err) {
    item.lastError = err instanceof Error ? err.message : 'Błąd sieci podczas wysyłki'
    return false
  }
}

function emitResidentCaptureStatus(item: StoredVoiceItem, status: ResidentCaptureSyncState['status']) {
  if (item.purpose !== 'resident_capture' || typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
  window.dispatchEvent(new CustomEvent<ResidentCaptureSyncState>('sc-resident-capture-status', {
    detail: { clientUuid: item.client_uuid, status },
  }))
}

export async function flushOfflineVoiceQueue(
  syncFn?: (item: OfflineVoiceItem) => Promise<boolean>,
  options?: { mode?: VoiceSyncMode; authorId?: string },
): Promise<{ synced: number; failed: number }> {
  const queue = await idbGetAllItems()
  const pendingItems = queue.filter((item) => {
    if (!belongsToSession(item, options?.authorId)) return false
    const resident = item.purpose === 'resident_capture'
    if (item.status === 'failed_permanent') return resident && options?.mode === 'manual'
    return options?.mode !== 'scheduled' || (resident && (item.nextAttemptAt ?? 0) <= Date.now())
  })
  if (pendingItems.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0
  const performSync = syncFn || sendOfflineVoiceItemToServer

  for (const stored of pendingItems) {
    const item: StoredVoiceItem = stored.status === 'failed_permanent'
      ? { ...stored, status: 'pending', attempts: 0 }
      : stored
    let sent = false
    try {
      sent = await performSync(item)
    } catch (error) {
      item.lastError = error instanceof Error ? error.message : 'Wyjątek sieciowy'
    }
    if (sent) {
      await idbDeleteItem(item.client_uuid)
      emitResidentCaptureStatus(item, 'submitted')
      synced++
      continue
    }
    const resident = item.purpose === 'resident_capture'
    if (resident && !isOnline() && item.status !== 'failed_permanent') break
    failed++
    item.attempts = (item.attempts ?? 0) + 1
    if (resident && item.status !== 'failed_permanent') {
      item.status = 'pending'
      item.nextAttemptAt = Date.now() + Math.min(120_000, firstRetryDelayMs * 2 ** Math.min(item.attempts, 5))
    } else if (item.attempts >= 3) {
      item.status = 'failed_permanent'
      item.lastError ||= 'Przekroczono limit prób synchronizacji (3).'
    }
    await idbPutItem(item)
    if (item.status === 'failed_permanent') emitResidentCaptureStatus(item, 'blocked')
  }

  await notifyOfflineQueueChange()
  return { synced, failed }
}
