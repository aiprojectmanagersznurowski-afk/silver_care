'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { detectSupportedAudioFormat } from '@/lib/voice-helpers'
import { generateClientUuid, enqueueOfflineVoiceItem, isOnline, blobToBase64 } from '@/lib/voice-offline-queue'

export type VoiceRecorderState = 'idle' | 'recording' | 'transcribing' | 'error'

export interface TranscribeResponse {
  success?: boolean
  text?: string
  transcript?: string
  newChunk?: string
  draftId?: string
  needsFollowup?: boolean
  question?: string
  error?: string
}

export interface UseVoiceRecorderOptions {
  getExtraFormData?: () => Record<string, string | null | undefined>
  onSuccess?: (data: TranscribeResponse) => void | Promise<void>
  onError?: (error: string) => void
  endpoint?: string
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}) {
  const { getExtraFormData, onSuccess, onError, endpoint = '/api/voice/transcribe' } = options
  const [state, setState] = useState<VoiceRecorderState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)

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
    setState('idle')
    setError(null)
    setDuration(0)
    cancelledRef.current = false
  }, [cleanup])

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true
    cleanup()
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop() } catch {}
    }
    audioChunksRef.current = []
    setState('idle')
    setDuration(0)
  }, [cleanup])

  const sendAudio = useCallback(async (blob: Blob, ext: string) => {
    setState('transcribing')
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const formData = new FormData()
      formData.append('file', blob, `recording.${ext}`)

      if (getExtraFormData) {
        const extra = getExtraFormData()
        for (const [key, val] of Object.entries(extra)) {
          if (val !== undefined && val !== null) formData.append(key, val)
        }
      }

      if (!formData.has('client_uuid')) {
        formData.append('client_uuid', generateClientUuid())
      }

      if (!isOnline()) {
        const clientUuid = (formData.get('client_uuid') as string) || generateClientUuid()
        const residentId = (formData.get('resident_id') as string) || ''
        const base64Audio = await blobToBase64(blob).catch(() => '')
        enqueueOfflineVoiceItem({
          client_uuid: clientUuid,
          resident_id: residentId,
          audioBlob: blob,
          audioBase64: base64Audio,
          mimeType: blob.type || `audio/${ext}`,
          createdAt: Date.now(),
        })
        const msg = 'Brak połączenia z siecią. Nagranie zostało zapisane w kolejce offline.'
        setError(msg)
        setState('error')
        onError?.(msg)
        return
      }

      const headers: Record<string, string> = {}
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

      const res = await fetch(endpoint, { method: 'POST', headers, body: formData })
      const data: TranscribeResponse = await res.json().catch(() => ({}))

      if (res.status === 401 && data.error === 'Unauthorized') {
        const msg = 'Sesja wygasła. Zaloguj się ponownie.'
        setError(msg); setState('error'); onError?.(msg); return
      }
      if (!res.ok || data.error || !data.success) {
        const msg = data.error || 'Wystąpił błąd podczas transkrypcji.'
        setError(msg); setState('error'); onError?.(msg); return
      }

      setState('idle')
      await onSuccess?.(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Błąd sieci podczas wysyłania nagrania.'
      setError(msg); setState('error'); onError?.(msg)
    }
  }, [endpoint, getExtraFormData, onError, onSuccess])

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

      const recorder = format.mimeType
        ? new MediaRecorder(stream, { mimeType: format.mimeType })
        : new MediaRecorder(stream)

      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      cancelledRef.current = false

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

      recorder.start(1000)
      setState('recording')
      setDuration(0)
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
    state,
    isRecording: state === 'recording',
    isTranscribing: state === 'transcribing',
    duration,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
  }
}
