/**
 * voice-offline-queue.ts — Obsługa kolejki nagrań offline dla asystenta głosowego.
 * Implements: VOICE-OFFLINE (kolejkowanie IndexedDB, deduplikacja po client_uuid, retry max 3, cel zapisu purpose).
 */

import {
  StoredVoiceItem,
  idbPutItem,
  idbGetItem,
  idbGetAllItems,
  idbDeleteItem,
  idbClearAll,
  base64ToBlob,
  blobToBase64,
} from './voice-idb-store'

export { base64ToBlob, blobToBase64 }

export type VoiceQueuePurpose = 'resident_note' | 'staff_message' | 'facility_import'
export type VoiceQueueStatus = 'pending' | 'failed_permanent'

export interface OfflineVoiceItem {
  client_uuid: string
  resident_id: string
  audioBlob?: Blob | null
  audioBase64?: string
  mimeType?: string
  ext?: string
  purpose?: VoiceQueuePurpose
  createdAt: number
  attempts?: number
  status?: VoiceQueueStatus
  lastError?: string
}

export interface VoiceQueueStats {
  pendingCount: number
  failedCount: number
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

export async function getOfflineQueueStats(): Promise<VoiceQueueStats> {
  const queue = await idbGetAllItems()
  let pendingCount = 0
  let failedCount = 0
  for (const item of queue) {
    if (item.status === 'failed_permanent') {
      failedCount++
    } else {
      pendingCount++
    }
  }
  return { pendingCount, failedCount }
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
  const hasBlob = Boolean(item.audioBlob && item.audioBlob.size > 0)
  const hasBase64 = Boolean(item.audioBase64 && item.audioBase64.trim().length > 0)

  if (!hasBlob && !hasBase64) {
    item.status = 'failed_permanent'
    item.lastError = 'Brak danych audio w elemencie kolejki.'
    await idbPutItem(item as StoredVoiceItem)
    await notifyOfflineQueueChange()
    return false
  }

  let blob = item.audioBlob
  const mime = item.mimeType || 'audio/webm'
  if (!blob && item.audioBase64) {
    blob = base64ToBlob(item.audioBase64, mime)
  }
  if (!blob || blob.size === 0) {
    item.status = 'failed_permanent'
    item.lastError = 'Nie udało się odtworzyć danych audio.'
    await idbPutItem(item as StoredVoiceItem)
    await notifyOfflineQueueChange()
    return false
  }

  try {
    const formData = new FormData()
    formData.append('client_uuid', item.client_uuid)
    if (item.resident_id) formData.append('resident_id', item.resident_id)
    formData.append('purpose', item.purpose || 'resident_note')

    const ext = item.ext || (mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : 'webm')
    formData.append('file', blob, `offline-${item.client_uuid}.${ext}`)

    const res = await fetch('/api/voice/transcribe', {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
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

export async function flushOfflineVoiceQueue(
  syncFn?: (item: OfflineVoiceItem) => Promise<boolean>
): Promise<{ synced: number; failed: number }> {
  const queue = await idbGetAllItems()
  const pendingItems = queue.filter((q) => q.status !== 'failed_permanent')
  if (pendingItems.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0
  const performSync = syncFn || sendOfflineVoiceItemToServer

  for (const item of pendingItems) {
    try {
      const ok = await performSync(item)
      if (ok) {
        synced++
        await idbDeleteItem(item.client_uuid)
      } else {
        failed++
        const attempts = (item.attempts || 0) + 1
        item.attempts = attempts
        if (attempts >= 3) {
          item.status = 'failed_permanent'
          if (!item.lastError) item.lastError = 'Przekroczono limit prób synchronizacji (3).'
        }
        await idbPutItem(item)
      }
    } catch (err) {
      failed++
      const attempts = (item.attempts || 0) + 1
      item.attempts = attempts
      item.lastError = err instanceof Error ? err.message : 'Wyjątek sieciowy'
      if (attempts >= 3) {
        item.status = 'failed_permanent'
      }
      await idbPutItem(item)
    }
  }

  await notifyOfflineQueueChange()
  return { synced, failed }
}
