'use client'

import { useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'

export function VoiceCaptureRecorder({ authorId, residentId }: { authorId: string; residentId?: string }) {
  const [submitted, setSubmitted] = useState(false)
  const recorder = useVoiceRecorder({
    endpoint: '/api/voice/captures',
    purpose: residentId ? 'resident_capture' : 'general_note',
    getExtraFormData: residentId ? () => ({ resident_id: residentId }) : undefined,
    authorId,
    onSuccess: () => setSubmitted(true),
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{residentId
        ? 'Nagraj notatkę o wybranym podopiecznym.'
        : 'Nagraj notatkę o przebiegu zmiany lub sprawie placówki.'}</p>
      {recorder.isRecording ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={recorder.stopRecording}><Square aria-hidden />Zakończ nagranie</Button>
          <Button type="button" variant="outline" onClick={recorder.cancelRecording}>Anuluj</Button>
          <span aria-label="Czas nagrania" className="text-sm tabular-nums">{recorder.duration} s</span>
        </div>
      ) : (
        <Button type="button" disabled={recorder.isTranscribing || Boolean(residentId && recorder.fallbackAudioBlob)} onClick={() => {
          setSubmitted(false)
          void recorder.startRecording()
        }}><Mic aria-hidden />Rozpocznij nagrywanie</Button>
      )}
      <div role="status" className="text-sm">
        {recorder.isTranscribing && 'Zapisywanie nagrania…'}
        {recorder.isQueued && 'Nagranie zapisano w kolejce offline.'}
        {submitted && 'Nagranie przyjęto do przetworzenia.'}
      </div>
      {recorder.error && !recorder.isQueued && <p role="alert" className="text-sm text-destructive">{recorder.error}</p>}
      {recorder.fallbackAudioBlob && (
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => void recorder.retryFallbackAudio()}>Ponów wysyłkę</Button>
          <Button type="button" variant="outline" onClick={recorder.downloadFallbackAudio}>Pobierz nagranie lokalnie</Button>
        </div>
      )}
    </div>
  )
}
