'use client'

import React, { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Mic, Square, Loader2, Sparkles } from 'lucide-react'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import { VoiceResidentSelect } from './VoiceResidentSelect'
import { VoiceReportReview } from './VoiceReportReview'
import { VoiceTranscriptionEditor } from './VoiceTranscriptionEditor'
import { PageHeader } from '@/components/patterns/PageHeader'

function VoiceNoteContent() {
  const searchParams = useSearchParams()
  const initialResidentId = searchParams.get('resident')
  const [activeResidentId, setActiveResidentId] = useState<string>(initialResidentId || '')
  const [resident, setResident] = useState<{ id: string; first_name?: string; last_name?: string } | null>(null)
  const [residentsList, setResidentsList] = useState<Array<{ id: string; first_name: string; last_name: string }>>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingResidents, setLoadingResidents] = useState(false)
  const [transcription, setTranscription] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const draftIdRef = useRef<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [finalReport, setFinalReport] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [followupQuestion, setFollowupQuestion] = useState<string | null>(null)
  const [medicationEvent, setMedicationEvent] = useState<string | null>(null)
  const [requiresMedConfirm, setRequiresMedConfirm] = useState(false)
  const supabase = createClient()

  const updateDraftId = (id: string | null) => {
    draftIdRef.current = id
    setDraftId(id)
  }

  const resetNote = () => {
    updateDraftId(null); setTranscription(null); setFollowupQuestion(null)
    setFinalReport(null); setError(null); setMedicationEvent(null); setRequiresMedConfirm(false); recorder.reset()
  }

  useEffect(() => {
    if (initialResidentId) void Promise.resolve().then(() => setActiveResidentId(initialResidentId))
  }, [initialResidentId])

  useEffect(() => {
    if (activeResidentId) {
      supabase.from('residents').select('*').eq('id', activeResidentId).single().then(({ data }) => { if (data) setResident(data) })
    } else {
      void Promise.resolve().then(() => setLoadingResidents(true))
      supabase.from('residents').select('id, first_name, last_name').is('archived_at', null).order('last_name').then(({ data }) => {
        if (data) setResidentsList(data); setLoadingResidents(false)
      })
    }
  }, [activeResidentId, supabase])

  const recorder = useVoiceRecorder({
    getExtraFormData: () => ({
      resident_id: activeResidentId,
      draft_id: draftIdRef.current,
    }),
    onSuccess: (data) => {
      if (data.draftId) updateDraftId(data.draftId)
      const newChunkText = (data.newChunk || data.transcript || data.text || '').trim()
      const fullText = (data.text || data.transcript || newChunkText).trim()

      if (!fullText) {
        setError('Nie udało się rozpoznać mowy w nagraniu. Upewnij się, że mikrofon nie był wyciszony i spróbuj ponownie.')
        return
      }

      setTranscription((prev) => (prev ? `${prev}\n\n[Uzupełnienie]: ${newChunkText}` : fullText))
      setFollowupQuestion(data.needsFollowup && data.question ? data.question : null)
    },
    onError: (err) => setError(err),
  })

  const handleStartRecord = async () => {
    if (!draftIdRef.current) { setTranscription(null); setFinalReport(null); setFollowupQuestion(null) }
    setError(null)
    await recorder.startRecording()
  }

  const generateAIReport = async () => {
    const currentDraftId = draftIdRef.current || draftId
    if (!currentDraftId) return
    setIsGenerating(true); setError(null); setFollowupQuestion(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

      const res = await fetch('/api/voice/process', {
        method: 'POST',
        headers,
        body: JSON.stringify({ draftId: currentDraftId, editedTranscription: transcription }),
      })
      if (res.status === 401) {
        setError('Sesja wygasła. Zaloguj się ponownie, aby kontynuować.')
        setTimeout(() => { window.location.href = '/login' }, 2000)
        return
      }
      const data = await res.json()
      if (res.ok && data.success) {
        if (data.needsFollowup) setFollowupQuestion(data.question)
        else {
          setFinalReport(data.report)
          setMedicationEvent(data.medication_event || null)
          setRequiresMedConfirm(Boolean(data.medication_alert_requires_confirmation))
          setFollowupQuestion(null)
        }
      } else {
        setError(data.error || 'Wystąpił błąd podczas generowania raportu.')
      }
    } catch {
      setError('Błąd sieci podczas wywoływania AI.')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!activeResidentId) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          back={{ href: '/staff', label: 'Wróć do tablicy dyżuru' }}
          title="Notatka Głosowa"
          description="Wybierz podopiecznego, dla którego chcesz nagrać notatkę ze statusu dnia."
        />
        <VoiceResidentSelect
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          residentsList={residentsList}
          loadingResidents={loadingResidents}
          onSelectResident={(r) => { setActiveResidentId(r.id); setResident(r) }}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        back={{ href: '/staff', label: 'Wróć do tablicy dyżuru' }}
        title="Notatka Głosowa"
        description={resident && (
          <>
            Dla: <span className="font-semibold text-foreground">{resident.first_name} {resident.last_name}</span>
            <button type="button" onClick={() => { setActiveResidentId(''); setResident(null); resetNote() }} className="ml-2 min-h-touch text-sm text-primary hover:underline">
              (Zmień podopiecznego)
            </button>
          </>
        )}
      />

      <Card className="overflow-hidden rounded-xl border-none ring-1 ring-border bg-card">
        <CardContent className="p-8 space-y-8 flex flex-col items-center">
          <div className="text-center space-y-2 max-w-md">
            <h3 className="font-medium text-foreground text-lg">Zaraportuj status</h3>
            <p className="text-sm text-muted-foreground">Nagraj wiadomość, a sztuczna inteligencja ztranskrybuje ją i przygotuje gotowy raport dla rodziny.</p>
          </div>

          {!finalReport && (
            <div className="flex flex-col items-center justify-center w-full mt-4 space-y-3">
              {!recorder.isRecording ? (
                <button onClick={handleStartRecord} disabled={recorder.isTranscribing || isGenerating} className="group relative flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-all hover:scale-105 disabled:opacity-50">
                  <div className="absolute inset-0 rounded-full ring-4 ring-primary/20 group-hover:animate-ping" />
                  <Mic className="h-10 w-10 relative z-10" />
                </button>
              ) : (
                <button onClick={recorder.stopRecording} className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all animate-pulse hover:scale-105">
                  <Square className="h-8 w-8 fill-current" />
                </button>
              )}
              <span className="text-sm font-medium text-muted-foreground">
                {recorder.isRecording ? `Nagrywanie (${recorder.duration}s)... Naciśnij kwadrat, aby zatrzymać` : draftId ? (followupQuestion ? 'Naciśnij mikrofon, aby dograć odpowiedź' : 'Naciśnij mikrofon, aby dograć uzupełnienie') : 'Naciśnij mikrofon, aby nagrać notatkę'}
              </span>
            </div>
          )}

          {recorder.isTranscribing && (
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
          {(error || recorder.error) && (
            <div className="w-full rounded-xl bg-destructive/10 p-4 border border-destructive/20 text-center">
              <p className="text-sm font-medium text-destructive">{error || recorder.error}</p>
              {recorder.fallbackAudioBlob && (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={recorder.downloadFallbackAudio} className="min-h-touch rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground">Pobierz nagranie lokalnie</button>
                  <button type="button" onClick={() => void recorder.retryFallbackAudio()} className="min-h-touch rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Ponów próbę</button>
                </div>
              )}
            </div>
          )}

          {transcription && !finalReport && !isGenerating && (
            <VoiceTranscriptionEditor
              transcription={transcription}
              setTranscription={setTranscription}
              followupQuestion={followupQuestion}
              onGenerateReport={generateAIReport}
              onResetNote={resetNote}
              isGenerating={isGenerating}
              isBusy={recorder.isTranscribing || recorder.isRecording}
            />
          )}

          {finalReport && (
            <VoiceReportReview
              finalReport={finalReport}
              onResetNote={resetNote}
              medicationEvent={medicationEvent}
              requiresMedicationConfirmation={requiresMedConfirm}
            />
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
