/**
 * voice-offline-queue.ts — Obsługa kolejki nagrań offline dla asystenta głosowego.
 * Implements: VOICE-OFFLINE (kolejkowanie offline, deduplikacja po client_uuid, sync po powrocie).
 */

export interface OfflineVoiceItem {
  client_uuid: string
  resident_id: string
  audioBlob?: Blob | null
  audioBase64?: string
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

export function base64ToBlob(base64: string, mimeType = 'audio/webm'): Blob {
  const byteCharacters = atob(base64)
  const byteArrays: Uint8Array[] = []
  const sliceSize = 512

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize)
    const byteNumbers = new Array(slice.length)
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i)
    }
    byteArrays.push(new Uint8Array(byteNumbers))
  }
  return new Blob(byteArrays as BlobPart[], { type: mimeType })
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1] || ''
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function sendOfflineVoiceItemToServer(item: OfflineVoiceItem): Promise<boolean> {
  try {
    const formData = new FormData()
    formData.append('client_uuid', item.client_uuid)
    formData.append('resident_id', item.resident_id)

    let blob = item.audioBlob
    const mime = item.mimeType || 'audio/webm'
    if (!blob && item.audioBase64) {
      blob = base64ToBlob(item.audioBase64, mime)
    }
    if (!blob) {
      blob = new Blob(['empty-offline-recording'], { type: mime })
    }

    const ext = mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : 'webm'
    formData.append('file', blob, `offline-${item.client_uuid}.${ext}`)

    const res = await fetch('/api/voice/transcribe', {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) return false
    const data = await res.json().catch(() => ({}))
    return Boolean(data.success)
  } catch {
    return false
  }
}

export async function flushOfflineVoiceQueue(
  syncFn?: (item: OfflineVoiceItem) => Promise<boolean>
): Promise<{ synced: number; failed: number }> {
  const queue = getOfflineVoiceQueue()
  if (queue.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0
  const remaining: OfflineVoiceItem[] = []

  const performSync = syncFn || sendOfflineVoiceItemToServer

  for (const item of queue) {
    try {
      const ok = await performSync(item)
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
