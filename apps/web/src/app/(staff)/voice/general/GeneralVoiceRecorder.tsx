'use client'

import { useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'

export function GeneralVoiceRecorder({ authorId }: { authorId: string }) {
  const [submitted, setSubmitted] = useState(false)
  const recorder = useVoiceRecorder({
    endpoint: '/api/voice/captures',
    purpose: 'general_note',
    authorId,
    onSuccess: () => setSubmitted(true),
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Nagraj notatkę o przebiegu zmiany lub sprawie placówki.</p>
      {recorder.isRecording ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={recorder.stopRecording}><Square aria-hidden />Zakończ nagranie</Button>
          <Button type="button" variant="outline" onClick={recorder.cancelRecording}>Anuluj</Button>
          <span aria-label="Czas nagrania" className="text-sm tabular-nums">{recorder.duration} s</span>
        </div>
      ) : (
        <Button type="button" disabled={recorder.isTranscribing} onClick={() => {
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
      {recorder.fallbackAudioBlob && <Button
        type="button" variant="outline" onClick={recorder.downloadFallbackAudio}>Pobierz nagranie lokalnie</Button>}
    </div>
  )
}
