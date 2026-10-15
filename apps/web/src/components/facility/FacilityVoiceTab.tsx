'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mic, Square, Check, AlertCircle, Loader2, Sparkles } from 'lucide-react'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import { parseFacilityVoiceNoteAction, createRoomWithBedsAction } from '@/actions/facility'

interface FacilityVoiceTabProps {
  onStructureChanged?: () => void
}

export function FacilityVoiceTab({ onStructureChanged }: FacilityVoiceTabProps) {
  const [isProcessingVoice, setIsProcessingVoice] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [voiceTranscription, setVoiceTranscription] = useState('')
  const [voiceRoomNumber, setVoiceRoomNumber] = useState('')
  const [voiceFloor, setVoiceFloor] = useState('')
  const [voiceSector, setVoiceSector] = useState('')
  const [voiceBedLabels, setVoiceBedLabels] = useState('')
  const [isSubmittingVoice, setIsSubmittingVoice] = useState(false)
  const [voiceSuccess, setVoiceSuccess] = useState<string | null>(null)

  const parseAndPopulate = async (text: string) => {
    setIsProcessingVoice(true)
    setVoiceError(null)
    try {
      const parseRes = await parseFacilityVoiceNoteAction(text)
      if (parseRes.error) throw new Error(parseRes.error)
      if (parseRes.parsed) {
        if (parseRes.parsed.number) setVoiceRoomNumber(parseRes.parsed.number)
        if (parseRes.parsed.floor) setVoiceFloor(parseRes.parsed.floor)
        if (parseRes.parsed.sector) setVoiceSector(parseRes.parsed.sector)
        if (parseRes.parsed.bedLabels && parseRes.parsed.bedLabels.length > 0) {
          setVoiceBedLabels(parseRes.parsed.bedLabels.join(', '))
        }
      }
    } catch (err: unknown) {
      setVoiceError(err instanceof Error ? err.message : 'Błąd parsowania parametrów')
    } finally {
      setIsProcessingVoice(false)
    }
  }

  const { isRecording, isTranscribing, startRecording, stopRecording } = useVoiceRecorder({
    onSuccess: async (data) => {
      const text = (data.text || data.transcript || '').trim()
      if (!text) {
        setVoiceError('Nie udało się przetranskrybować nagrania (brak tekstu).')
        return
      }
      setVoiceTranscription(text)
      await parseAndPopulate(text)
    },
    onError: (err) => setVoiceError(err),
  })

  const handleManualTranscribeParse = async () => {
    if (!voiceTranscription.trim()) return
    await parseAndPopulate(voiceTranscription)
  }

  const handleSaveVoiceRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingVoice(true)
    setVoiceError(null)
    setVoiceSuccess(null)

    const labels = voiceBedLabels.split(',').map((s) => s.trim()).filter(Boolean)
    const res = await createRoomWithBedsAction({
      number: voiceRoomNumber,
      floor: voiceFloor,
      sector: voiceSector || null,
      bedLabels: labels,
    })
    setIsSubmittingVoice(false)

    if (res.error) {
      setVoiceError(res.error)
    } else {
      setVoiceSuccess(`Pomyślnie dodano pokój ${voiceRoomNumber}.`)
      setVoiceRoomNumber('')
      setVoiceFloor('')
      setVoiceSector('')
      setVoiceBedLabels('')
      setVoiceTranscription('')
      onStructureChanged?.()
    }
  }

  const isBusy = isProcessingVoice || isTranscribing

  return (
    <div className="space-y-4">
      <div className="p-4 bg-muted rounded-xl border border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Podyktuj parametry nowego pokoju
            </h4>
            <p className="text-sm text-muted-foreground">
              Np.: &quot;Dodaj pokój 205 na drugim piętrze, sektor B, z dwoma łóżkami A i B&quot;.
            </p>
          </div>
          <Button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isBusy}
            variant={isRecording ? 'destructive' : 'default'}
            className={`gap-2 ${!isRecording ? 'bg-primary hover:bg-primary/90 text-white' : ''}`}
          >
            {isRecording ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                Zatrzymaj nagrywanie
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Nagraj głosowo
              </>
            )}
          </Button>
        </div>

        {isBusy && (
          <div className="flex items-center gap-2 text-sm text-foreground bg-card p-3 rounded-lg border border-border">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Przetwarzanie audio i ekstrakcja parametrów struktury...</span>
          </div>
        )}

        <div className="mt-3">
          <Label htmlFor="voice-transcript" className="text-sm font-medium text-foreground mb-1 block">
            Transkrypcja lub polecenie słowne:
          </Label>
          <div className="flex gap-2">
            <Input
              id="voice-transcript"
              value={voiceTranscription}
              onChange={(e) => setVoiceTranscription(e.target.value)}
              placeholder="Możesz również wpisać polecenie słowne tutaj..."
              className="text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleManualTranscribeParse}
              disabled={isBusy || !voiceTranscription.trim()}
              className="gap-1 text-sm shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Przetwórz AI
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveVoiceRoom} className="p-4 bg-card rounded-xl border border-border space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Wyodrębnione parametry pokoju (do weryfikacji)
        </h4>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="v-number" className="text-sm">Numer pokoju *</Label>
            <Input
              id="v-number"
              value={voiceRoomNumber}
              onChange={(e) => setVoiceRoomNumber(e.target.value)}
              placeholder="np. 101 lub 205B"
              required
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="v-floor" className="text-sm">Piętro *</Label>
            <Input
              id="v-floor"
              value={voiceFloor}
              onChange={(e) => setVoiceFloor(e.target.value)}
              placeholder="np. Parter, 1, 2"
              required
              className="mt-1 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="v-sector" className="text-sm">Sektor / Skrzydło (opcjonalnie)</Label>
            <Input
              id="v-sector"
              value={voiceSector}
              onChange={(e) => setVoiceSector(e.target.value)}
              placeholder="np. Skrzydło A, Zachód"
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="v-beds" className="text-sm">Etykiety łóżek (oddzielone przecinkami)</Label>
            <Input
              id="v-beds"
              value={voiceBedLabels}
              onChange={(e) => setVoiceBedLabels(e.target.value)}
              placeholder="np. 1, 2 lub A, B"
              className="mt-1 text-sm"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button
            type="submit"
            disabled={isSubmittingVoice || !voiceRoomNumber.trim() || !voiceFloor.trim()}
            className="bg-primary hover:bg-primary/90 text-white gap-2 text-sm"
          >
            {isSubmittingVoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Dodaj pokój i łóżka
          </Button>
        </div>
      </form>

      {voiceError && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{voiceError}</span>
        </div>
      )}

      {voiceSuccess && (
        <div className="p-3 bg-muted border border-border text-foreground rounded-lg text-sm flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{voiceSuccess}</span>
        </div>
      )}
    </div>
  )
}
