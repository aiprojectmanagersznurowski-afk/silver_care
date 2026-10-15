'use client'

import React from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Sparkles, AlertTriangle, X } from 'lucide-react'

interface VoiceTranscriptionEditorProps {
  transcription: string
  setTranscription: (val: string) => void
  followupQuestion: string | null
  onGenerateReport: () => void
  onResetNote: () => void
  isGenerating: boolean
  isBusy: boolean
}

export function VoiceTranscriptionEditor({
  transcription,
  setTranscription,
  followupQuestion,
  onGenerateReport,
  onResetNote,
  isGenerating,
  isBusy,
}: VoiceTranscriptionEditorProps) {
  return (
    <div className="w-full rounded-xl bg-muted/50 p-6 border border-border shadow-inner">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-foreground">Treść notatki:</h4>
        <span className="text-sm font-medium text-muted-foreground">Możesz edytować lub dopisać tekst</span>
      </div>
      <Textarea className="w-full mb-6" value={transcription} onChange={(e) => setTranscription(e.target.value)} />
      {followupQuestion && (
        <div className="mb-6 rounded-xl bg-muted p-5 ring-1 ring-inset ring-border">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-foreground shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-foreground font-bold text-sm block mb-1">AI dopytuje:</span>
              <p className="text-sm text-foreground font-semibold">{followupQuestion}</p>
              <p className="text-sm text-foreground mt-2 font-medium">Możesz nagrać odpowiedź mikrofonem powyżej LUB dopisać brakujące dane bezpośrednio w polu tekstowym powyżej.</p>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onGenerateReport}
          disabled={isGenerating || isBusy}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-11"
        >
          <Sparkles className="h-4 w-4" /> {followupQuestion ? 'Zatwierdź uzupełnienie i buduj raport' : 'Buduj raport'}
        </button>
        <button
          onClick={onResetNote}
          disabled={isGenerating || isBusy}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-card px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 ring-1 ring-inset ring-border transition-colors disabled:opacity-50 min-h-11"
        >
          <X className="h-4 w-4 mr-1" /> Zacznij od nowa
        </button>
      </div>
    </div>
  )
}
