'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { detectSupportedAudioFormat } from '@/lib/voice-helpers'
import {
  generateClientUuid,
  enqueueOfflineVoiceItem,
  isOnline,
  VoiceQueuePurpose,
} from '@/lib/voice-offline-queue'

export type VoiceRecorderState = 'idle' | 'recording' | 'transcribing' | 'queued' | 'error'

export interface TranscribeResponse {
  success?: boolean; text?: string; transcript?: string; newChunk?: string
  draftId?: string; needsFollowup?: boolean; question?: string; error?: string
}

export interface UseVoiceRecorderOptions {
  purpose?: VoiceQueuePurpose
  getExtraFormData?: () => Record<string, string | null | undefined>
  onSuccess?: (data: TranscribeResponse) => void | Promise<void>
  onError?: (error: string) => void
  endpoint?: string
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}) {
  const { purpose = 'resident_note', getExtraFormData, onSuccess, onError, endpoint = '/api/voice/transcribe' } = options
  const [state, setState] = useState<VoiceRecorderState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [fallbackAudioBlob, setFallbackAudioBlob] = useState<Blob | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelledRef = useRef(false)

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach((track) => track.stop()) } catch {}
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      cleanup()
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop() } catch {}
      }
    }
  }, [cleanup])

  const reset = useCallback(() => {
    cleanup()
    audioChunksRef.current = []
    setState('idle'); setError(null); setDuration(0); setFallbackAudioBlob(null); cancelledRef.current = false
  }, [cleanup])

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true; cleanup()
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop() } catch {}
    }
    audioChunksRef.current = []; setState('idle'); setDuration(0)
  }, [cleanup])

  const handleQueueAudio = useCallback(async (
    blob: Blob, ext: string, clientUuid: string, residentId: string, msg: string
  ) => {
    try {
      await enqueueOfflineVoiceItem({
        client_uuid: clientUuid, resident_id: residentId, audioBlob: blob,
        mimeType: blob.type || `audio/${ext}`, ext, purpose,
        createdAt: Date.now(), attempts: 0, status: 'pending',
      })
      setState('queued'); setError(msg); onError?.(msg)
    } catch {
      setFallbackAudioBlob(blob)
      const quotaMsg = 'Brak miejsca na urządzeniu. Nagranie zachowano w pamięci — pobierz je lokalnie.'
      setError(quotaMsg); setState('error'); onError?.(quotaMsg)
    }
  }, [onError, purpose])

  const sendAudio = useCallback(async (blob: Blob, ext: string) => {
    setState('transcribing'); setError(null); setFallbackAudioBlob(null)
    const clientUuid = generateClientUuid()
    let residentId = ''
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const formData = new FormData()
      formData.append('file', blob, `recording.${ext}`)
      formData.append('client_uuid', clientUuid)
      if (getExtraFormData) {
        const extra = getExtraFormData()
        for (const [key, val] of Object.entries(extra)) {
          if (val !== undefined && val !== null) formData.append(key, val)
        }
      }
      residentId = (formData.get('resident_id') as string) || ''
      if (!isOnline()) {
        await handleQueueAudio(blob, ext, clientUuid, residentId, 'Brak połączenia z siecią. Nagranie zapisano w kolejce offline.')
        return
      }
      const headers: Record<string, string> = {}
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
      const res = await fetch(endpoint, { method: 'POST', headers, body: formData })
      if (res.status >= 500) {
        await handleQueueAudio(blob, ext, clientUuid, residentId, `Serwer placówki niedostępny (HTTP ${res.status}). Zapisano w kolejce offline.`)
        return
      }
      const data: TranscribeResponse = await res.json().catch(() => ({}))
      if (res.status === 401 && data.error === 'Unauthorized') {
        const msg = 'Sesja wygasła. Zaloguj się ponownie.'
        setError(msg); setState('error'); onError?.(msg); return
      }
      if (!res.ok || data.error || !data.success) {
        const msg = data.error || 'Wystąpił błąd podczas transkrypcji.'
        setError(msg); setState('error'); onError?.(msg); return
      }
      setState('idle'); await onSuccess?.(data)
    } catch {
      await handleQueueAudio(blob, ext, clientUuid, residentId, 'Błąd sieci podczas wysyłania. Nagranie zabezpieczono w kolejce offline.')
    }
  }, [endpoint, getExtraFormData, handleQueueAudio, onError, onSuccess])

  const downloadFallbackAudio = useCallback(() => {
    if (!fallbackAudioBlob || typeof window === 'undefined') return
    const url = URL.createObjectURL(fallbackAudioBlob)
    const a = document.createElement('a')
    a.href = url
    const ext = fallbackAudioBlob.type.includes('mp4') || fallbackAudioBlob.type.includes('m4a') ? 'm4a' : 'webm'
    a.download = `nagranie-awaryjne-${Date.now()}.${ext}`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }, [fallbackAudioBlob])

  const retryFallbackAudio = useCallback(async () => {
    if (!fallbackAudioBlob) return
    const blob = fallbackAudioBlob; setFallbackAudioBlob(null)
    const ext = blob.type.includes('mp4') || blob.type.includes('m4a') ? 'm4a' : 'webm'
    await sendAudio(blob, ext)
  }, [fallbackAudioBlob, sendAudio])

  const startRecording = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const msg = 'Twoja przeglądarka nie wspiera nagrywania dźwięku.'
      setError(msg); setState('error'); onError?.(msg); return
    }
    reset()
    try {
      const format = detectSupportedAudioFormat()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = format.mimeType ? new MediaRecorder(stream, { mimeType: format.mimeType }) : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder; audioChunksRef.current = []; cancelledRef.current = false
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        cleanup()
        if (cancelledRef.current) return
        const actualMime = recorder.mimeType || format.mimeType || 'audio/webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime })
        audioChunksRef.current = []
        if (audioBlob.size === 0) {
          const msg = 'Nagranie jest puste (brak danych audio). Upewnij się, że mikrofon działa poprawnie i spróbuj ponownie.'
          setError(msg); setState('error'); onError?.(msg); return
        }
        await sendAudio(audioBlob, format.ext)
      }
      recorder.start(1000); setState('recording'); setDuration(0)
      timerRef.current = setInterval(() => setDuration((prev) => prev + 1), 1000)
    } catch {
      cleanup()
      const msg = 'Brak dostępu do mikrofonu. Upewnij się, że przyznano uprawnienia.'
      setError(msg); setState('error'); onError?.(msg)
    }
  }, [reset, cleanup, sendAudio, onError])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop() } catch {}
    }
  }, [])

  return {
    state, isRecording: state === 'recording', isTranscribing: state === 'transcribing',
    isQueued: state === 'queued', duration, error, fallbackAudioBlob,
    downloadFallbackAudio, retryFallbackAudio, startRecording, stopRecording, cancelRecording, reset,
  }
}
