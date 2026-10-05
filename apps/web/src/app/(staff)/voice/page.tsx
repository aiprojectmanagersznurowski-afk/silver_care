'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Mic, Square, Loader2, Sparkles, AlertTriangle, ArrowRight, X } from 'lucide-react'
import Link from 'next/link'
import { Textarea } from '@/components/ui/textarea'

function VoiceNoteContent() {
  const searchParams = useSearchParams()
  const residentId = searchParams.get('resident')
  const [resident, setResident] = useState<{ id: string; first_name?: string; last_name?: string } | null>(null)

  
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcription, setTranscription] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const draftIdRef = useRef<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [finalReport, setFinalReport] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [followupQuestion, setFollowupQuestion] = useState<string | null>(null)
  
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const audioChunks = useRef<Blob[]>([])
  
  const supabase = createClient()

  const updateDraftId = (id: string | null) => {
    draftIdRef.current = id
    setDraftId(id)
  }

  const resetNote = () => {
    updateDraftId(null)
    setTranscription(null)
    setFollowupQuestion(null)
    setFinalReport(null)
    setError(null)
  }

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
      // Jeśli użytkownik nagrywa od zera (brak draftId), czyścimy poprzednie wyniki
      if (!draftIdRef.current) {
        setTranscription(null)
        setFinalReport(null)
        setFollowupQuestion(null)
      }
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

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      return headers
    } catch {
      return {}
    }
  }

  const processAudio = async (audioBlob: Blob) => {
    if (!residentId) {
      setError('Nie wybrano podopiecznego.')
      return
    }

    setIsProcessing(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', audioBlob, 'recording.webm')
    formData.append('resident_id', residentId)
    const currentDraftId = draftIdRef.current
    if (currentDraftId) {
      formData.append('draft_id', currentDraftId)
    }

    try {
      const headers = await getAuthHeaders()
      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers,
        body: formData,
      })

      if (response.status === 401) {
        setError('Sesja wygasła. Zaloguj się ponownie, aby zapisać notatkę.')
        setTimeout(() => {
          window.location.href = '/login'
        }, 2000)
        return
      }

      const data = await response.json()

      if (response.ok && data.success) {
        setTranscription(data.text)
        updateDraftId(data.draftId)
        setFollowupQuestion(null) // dograno odpowiedź na pytanie AI — czyścimy blokadę dopytywania
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
    const currentDraftId = draftIdRef.current || draftId
    if (!currentDraftId) return
    setIsGenerating(true)
    setError(null)
    setFollowupQuestion(null)

    try {
      const headers = await getAuthHeaders()
      headers['Content-Type'] = 'application/json'

      const response = await fetch('/api/voice/process', {
        method: 'POST',
        headers,
        body: JSON.stringify({ draftId: currentDraftId, editedTranscription: transcription })
      })

      if (response.status === 401) {
        setError('Sesja wygasła. Zaloguj się ponownie, aby kontynuować.')
        setTimeout(() => {
          window.location.href = '/login'
        }, 2000)
        return
      }

      const data = await response.json()

      if (response.ok && data.success) {
        if (data.needsFollowup) {
          setFollowupQuestion(data.question)
        } else {
          setFinalReport(data.report)
          setFollowupQuestion(null)
        }
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
    return (
      <div className="flex h-[400px] items-center justify-center rounded-xl border border-dashed border-border bg-card">
        <p className="text-muted-foreground">Brak ID podopiecznego. Wróć do tablicy.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-3xl font-display font-semibold tracking-tight text-foreground">
          Notatka Głosowa
        </h2>
        {resident && (
          <p className="mt-2 text-muted-foreground text-lg">
            Dla: <span className="font-semibold text-foreground">{resident.first_name} {resident.last_name}</span>
          </p>
        )}
      </div>

      <Card className="overflow-hidden rounded-xl border-none ring-1 ring-border bg-card">
        <CardContent className="p-8 space-y-8 flex flex-col items-center">
          
          <div className="text-center space-y-2 max-w-md">
            <h3 className="font-medium text-foreground text-lg">Zaraportuj status</h3>
            <p className="text-sm text-muted-foreground">
              Nagraj wiadomość, a sztuczna inteligencja ztranskrybuje ją i przygotuje gotowy raport dla rodziny.
            </p>
          </div>

          {!finalReport && (
            <div className="flex flex-col items-center justify-center w-full mt-4 space-y-3">
              {!isRecording ? (
                <button 
                  onClick={startRecording} 
                  disabled={isProcessing || isGenerating} 
                  className="group relative flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-all hover:bg-destructive/10 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                >
                  <div className="absolute inset-0 rounded-full ring-4 ring-primary/20 group-hover:animate-ping"></div>
                  <Mic className="h-10 w-10 relative z-10" />
                </button>
              ) : (
                <button 
                  onClick={stopRecording} 
                  className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all animate-pulse hover:scale-105"
                >
                  <Square className="h-8 w-8 fill-current" />
                </button>
              )}
              <span className="text-xs font-medium text-muted-foreground">
                {isRecording 
                  ? 'Nagrywanie... Naciśnij kwadrat, aby zatrzymać' 
                  : draftId 
                    ? (followupQuestion ? 'Naciśnij mikrofon, aby dograć odpowiedź' : 'Naciśnij mikrofon, aby dograć uzupełnienie') 
                    : 'Naciśnij mikrofon, aby nagrać notatkę'}
              </span>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm font-medium">Przetwarzanie i transkrypcja audio...</p>
            </div>
          )}
          
          {isGenerating && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Sparkles className="h-5 w-5 animate-pulse text-primary" />
              <p className="text-sm font-medium">AI analizuje notatkę i buduje raport...</p>
            </div>
          )}

          {error && (
            <div className="w-full rounded-xl bg-destructive/10 p-4 border border-destructive/20 text-center">
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          )}

          {transcription && !finalReport && !isGenerating && (
            <div className="w-full rounded-xl bg-muted/50 p-6 border border-border shadow-inner">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-foreground">Treść notatki:</h4>
                <span className="text-xs font-medium text-muted-foreground">Możesz edytować lub dopisać tekst</span>
              </div>
              
              <Textarea className="w-full mb-6"
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
              />
              
              {followupQuestion && (
                <div className="mb-6 rounded-xl bg-muted p-5 ring-1 ring-inset ring-border">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-foreground shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="text-foreground font-bold text-sm block mb-1">AI dopytuje:</span>
                      <p className="text-sm text-foreground font-semibold">{followupQuestion}</p>
                      <p className="text-xs text-foreground mt-2 font-medium">
                        Możesz nagrać odpowiedź mikrofonem powyżej LUB dopisać brakujące dane bezpośrednio w polu tekstowym powyżej i zatwierdzić raport.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={generateAIReport} 
                  disabled={isGenerating || isProcessing || isRecording}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {followupQuestion ? 'Zatwierdź uzupełnienie i buduj raport' : 'Buduj raport'}
                </button>
                <button 
                  onClick={resetNote}
                  disabled={isGenerating || isProcessing || isRecording}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-card px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 ring-1 ring-inset ring-border transition-colors disabled:opacity-50"
                >
                  <X className="h-4 w-4 mr-1" />
                  Zacznij od nowa
                </button>
              </div>
            </div>
          )}

          {finalReport && (
            <div className="w-full rounded-xl bg-muted p-6 ring-1 ring-inset ring-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h4 className="text-base font-semibold text-foreground">Szkic raportu gotowy</h4>
              </div>
              <p className="text-sm text-foreground mb-6 leading-relaxed bg-card/60 p-4 rounded-xl">{finalReport}</p>
              
              <div className="flex items-start gap-3 mb-6 p-4 rounded-xl bg-muted ring-1 ring-inset ring-border">
                <AlertTriangle className="h-5 w-5 text-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-foreground font-medium leading-relaxed">
                  Twarde dane medyczne (np. parametry, leki) zostały usunięte z powyższego tekstu i bezpiecznie zarchiwizowane. Szkic możesz zatwierdzić w zakładce Raporty.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/staff/reports" className="flex-1 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary transition-colors">
                  Przejdź do weryfikacji raportów
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button 
                  onClick={resetNote}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-card px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 ring-1 ring-inset ring-border transition-colors"
                >
                  Nagraj nową notatkę
                </button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  )
}

export default function VoiceNotePage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
      <VoiceNoteContent />
    </Suspense>
  )
}
