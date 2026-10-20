/**
 * voice-idb-store.ts — Niskopoziomowy magazyn IndexedDB dla nagrań audio offline (VOICE-OFFLINE).
 * Zapewnia bezpieczny fallback in-memory dla środowisk Node / Vitest / SSR bez natywnego IDB.
 */

export interface StoredVoiceItem {
  client_uuid: string
  resident_id: string
  audioBlob?: Blob | null
  audioBase64?: string
  mimeType?: string
  ext?: string
  purpose?: 'resident_note' | 'staff_message' | 'facility_import'
  createdAt: number
  attempts: number
  status: 'pending' | 'failed_permanent'
  lastError?: string
}

const DB_NAME = 'silvercare_voice_offline_db'
const DB_VERSION = 1
const STORE_NAME = 'voice_items'

const memoryStore = new Map<string, StoredVoiceItem>()

function canUseIdb(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function getDb(): Promise<IDBDatabase | null> {
  if (!canUseIdb()) return Promise.resolve(null)
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'client_uuid' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

export async function idbPutItem(item: StoredVoiceItem): Promise<void> {
  memoryStore.set(item.client_uuid, item)
  const db = await getDb()
  if (!db) return
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.put(item)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    } catch (err) {
      reject(err)
    }
  })
}

export async function idbGetItem(client_uuid: string): Promise<StoredVoiceItem | null> {
  const mem = memoryStore.get(client_uuid)
  const db = await getDb()
  if (!db) return mem || null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(client_uuid)
      req.onsuccess = () => resolve((req.result as StoredVoiceItem) || mem || null)
      req.onerror = () => resolve(mem || null)
    } catch {
      resolve(mem || null)
    }
  })
}

export async function idbGetAllItems(): Promise<StoredVoiceItem[]> {
  const db = await getDb()
  if (!db) return Array.from(memoryStore.values())
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.getAll()
      req.onsuccess = () => {
        const items = (req.result || []) as StoredVoiceItem[]
        for (const it of items) memoryStore.set(it.client_uuid, it)
        resolve(items.length > 0 ? items : Array.from(memoryStore.values()))
      }
      req.onerror = () => resolve(Array.from(memoryStore.values()))
    } catch {
      resolve(Array.from(memoryStore.values()))
    }
  })
}

export async function idbDeleteItem(client_uuid: string): Promise<void> {
  memoryStore.delete(client_uuid)
  const db = await getDb()
  if (!db) return
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.delete(client_uuid)
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function idbClearAll(): Promise<void> {
  memoryStore.clear()
  const db = await getDb()
  if (!db) return
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.clear()
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

export function base64ToBlob(base64: string, mimeType = 'audio/webm'): Blob {
  const byteCharacters = atob(base64)
  const byteArrays: Uint8Array[] = []
  const sliceSize = 512
  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize)
    const byteNumbers = new Array(slice.length)
    for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i)
    byteArrays.push(new Uint8Array(byteNumbers))
  }
  return new Blob(byteArrays as BlobPart[], { type: mimeType })
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      resolve(dataUrl.split(',')[1] || '')
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
