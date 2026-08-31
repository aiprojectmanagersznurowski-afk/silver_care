'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

export default function VoiceNotePage() {
  const searchParams = useSearchParams()
  const residentId = searchParams.get('resident')
  const [resident, setResident] = useState<any>(null)
  
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcription, setTranscription] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [finalReport, setFinalReport] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const audioChunks = useRef<Blob[]>([])
  
  const supabase = createClient()

  useEffect(() => {
    if (residentId) {
      supabase.from('residents').select('*').eq('id', residentId).single().then(({ data }) => {
        if (data) setResident(data)
      })
    }
  }, [residentId, supabase])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder.current = new MediaRecorder(stream)
      
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.current.push(e.data)
        }
      }
      
      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' })
        audioChunks.current = []
        await processAudio(audioBlob)
      }
      
      mediaRecorder.current.start()
      setIsRecording(true)
      setError(null)
      setTranscription(null)
      setDraftId(null)
      setFinalReport(null)
    } catch (err) {
      console.error('Error accessing microphone:', err)
      setError('Brak dostępu do mikrofonu. Upewnij się, że udzieliłeś pozwoleń.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop()
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop())
      setIsRecording(false)
    }
  }

  const processAudio = async (audioBlob: Blob) => {
    if (!residentId) {
      setError('Nie wybrano pensjonariusza.')
      return
    }

    setIsProcessing(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', audioBlob, 'recording.webm')
    formData.append('resident_id', residentId)

    try {
      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setTranscription(data.text)
        setDraftId(data.draftId)
      } else {
        setError(data.error || 'Wystąpił błąd podczas transkrypcji.')
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError('Błąd sieci podczas wysyłania nagrania.')
    } finally {
      setIsProcessing(false)
    }
  }

  const generateAIReport = async () => {
    if (!draftId) return
    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/voice/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ draftId })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setFinalReport(data.report)
      } else {
        setError(data.error || 'Wystąpił błąd podczas generowania raportu.')
      }
    } catch (err) {
      console.error('Generate error:', err)
      setError('Błąd sieci podczas wywoływania AI.')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!residentId) {
    return <div className="p-4 text-center">Brak ID pensjonariusza w linku. Wróć do tablicy.</div>
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Notatka Głosowa
        </h2>
        {resident && (
          <p className="text-text-secondary">Dla: {resident.first_name} {resident.last_name}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Zaraportuj status</CardTitle>
          <CardDescription>
            Nagraj wiadomość, a sztuczna inteligencja ztranskrybuje ją do bazy danych i przygotuje gotowy raport.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 flex flex-col items-center">
          
          {!finalReport && (
            <div className="flex justify-center space-x-4">
              {!isRecording ? (
                <Button onClick={startRecording} disabled={isProcessing || isGenerating} size="lg" className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Rozpocznij nagrywanie
                </Button>
              ) : (
                <Button onClick={stopRecording} size="lg" variant="outline" className="animate-pulse border-destructive text-destructive">
                  Zatrzymaj nagrywanie
                </Button>
              )}
            </div>
          )}

          {isProcessing && (
             <p className="text-sm text-text-secondary animate-pulse">Przetwarzanie i transkrypcja audio...</p>
          )}
          
          {isGenerating && (
             <p className="text-sm text-text-secondary animate-pulse">AI przetwarza dane medyczne i buduje empatyczny raport...</p>
          )}

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          {transcription && !finalReport && !isGenerating && (
            <div className="w-full mt-6 rounded-lg bg-surface-sunken p-4 border border-border">
              <h4 className="text-sm font-semibold mb-2">Surowa transkrypcja:</h4>
              <p className="text-sm mb-4">{transcription}</p>
              
              <div className="flex space-x-2">
                <Button onClick={generateAIReport} className="flex-1">
                  Rozdziel medycznie i buduj raport dla rodziny
                </Button>
                <Button variant="outline" onClick={() => setTranscription(null)}>
                  Odrzuć
                </Button>
              </div>
            </div>
          )}

          {finalReport && (
            <div className="w-full mt-6 rounded-lg bg-primary/5 p-4 border border-primary/20">
              <div className="flex items-center space-x-2 mb-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
                <h4 className="text-sm font-semibold text-primary">Szkic raportu dla rodziny gotowy</h4>
              </div>
              <p className="text-sm mb-4">{finalReport}</p>
              <p className="text-xs text-text-tertiary mb-4">
                Twarde dane medyczne (np. leki) zostały usunięte z powyższego tekstu i bezpiecznie zarchiwizowane w logach wewnętrznych. Szkic możesz zatwierdzić w zakładce "Raporty".
              </p>
              
              <a href="/reports" className="block w-full">
                <Button variant="default" className="w-full">
                  Przejdź do weryfikacji
                </Button>
              </a>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
