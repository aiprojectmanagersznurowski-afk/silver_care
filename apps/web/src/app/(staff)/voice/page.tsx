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
    // Vercel Edge / FormData handles Blob, but it's good to give it a filename
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
            Nagraj wiadomość, a sztuczna inteligencja ztranskrybuje ją do bazy danych.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 flex flex-col items-center">
          
          <div className="flex justify-center space-x-4">
            {!isRecording ? (
              <Button onClick={startRecording} disabled={isProcessing} size="lg" className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Rozpocznij nagrywanie
              </Button>
            ) : (
              <Button onClick={stopRecording} size="lg" variant="outline" className="animate-pulse border-destructive text-destructive">
                Zatrzymaj nagrywanie
              </Button>
            )}
          </div>

          {isProcessing && (
             <p className="text-sm text-text-secondary animate-pulse">Przetwarzanie i transkrypcja...</p>
          )}

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          {transcription && (
            <div className="w-full mt-6 rounded-lg bg-surface-sunken p-4">
              <h4 className="text-sm font-semibold mb-2">Wynik transkrypcji:</h4>
              <p className="text-sm">{transcription}</p>
              <div className="mt-4">
                 <Button variant="outline" size="sm" onClick={() => setTranscription(null)}>
                   Nagraj ponownie
                 </Button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
