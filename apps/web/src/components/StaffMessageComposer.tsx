'use client'

import React from 'react'
import { Send, RefreshCw, ShieldAlert, CornerDownRight, Mic, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'

interface StaffMessageComposerProps {
  replyText: string
  setReplyText: React.Dispatch<React.SetStateAction<string>>
  onSendReply: () => void
  isSending: boolean
  sendError: string | null
}

export function StaffMessageComposer({
  replyText,
  setReplyText,
  onSendReply,
  isSending,
  sendError,
}: StaffMessageComposerProps) {
  const { isRecording, isTranscribing, duration, startRecording, stopRecording } = useVoiceRecorder({
    onSuccess: (data) => {
      const transcribedText = (data.text || data.transcript || '').trim()
      if (transcribedText) {
        setReplyText((prev) => (prev ? `${prev} ${transcribedText}` : transcribedText))
        toast.success('Pomyślnie przetranskrybowano nagranie.')
      } else {
        toast.info('Nie wykryto mowy w nagraniu.')
      }
    },
    onError: (err) => {
      toast.error(err || 'Błąd transkrypcji nagrania')
    },
  })

  const toggleVoiceRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      void startRecording()
    }
  }

  return (
    <div className="p-4 border-t border-border bg-card">
      {isRecording && (
        <div
          data-testid="voice-recording-indicator"
          className="mb-3 flex items-center justify-between rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-sm text-destructive animate-pulse"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
            </span>
            <span className="font-semibold">Nagrywanie odpowiedzi głosowej... ({duration}s)</span>
          </div>
        </div>
      )}

      {isTranscribing && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 p-2.5 text-sm text-primary">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span>Przetwarzanie i transkrypcja odpowiedzi audio...</span>
        </div>
      )}

      {sendError && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-sm text-destructive">
          <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
          <span>{sendError}</span>
        </div>
      )}

      <div className="flex gap-2 items-end bg-muted/50 rounded-xl p-2 border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
        <Textarea
          rows={2}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Wpisz lub podyktuj odpowiedź do rodziny podopiecznego..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSendReply()
            }
          }}
          className="flex-1 md:text-sm"
        />

        <button
          type="button"
          data-testid="dictate-reply-button"
          onClick={toggleVoiceRecording}
          disabled={isSending || isTranscribing}
          aria-label={isRecording ? 'Zatrzymaj nagrywanie' : 'Podyktuj odpowiedź'}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
            isRecording
              ? 'bg-destructive text-white hover:bg-destructive/90 animate-pulse'
              : isTranscribing
              ? 'bg-muted text-muted-foreground cursor-wait'
              : 'bg-card border border-border text-foreground hover:bg-muted/80'
          }`}
        >
          {isTranscribing ? (
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          ) : isRecording ? (
            <>
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Mic className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">Dyktuj</span>
            </>
          )}
        </button>

        <button
          onClick={onSendReply}
          disabled={isSending || !replyText.trim()}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
            replyText.trim() && !isSending
              ? 'bg-primary text-white hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          {isSending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              <span>Wyślij</span>
            </>
          )}
        </button>
      </div>
      <p className="text-sm text-muted-foreground mt-1.5 px-2 flex items-center gap-1">
        <CornerDownRight className="h-3 w-3 text-muted-foreground" />
        Wciśnij Enter, aby wysłać odpowiedź. Shift+Enter tworzy nową linię.
      </p>
    </div>
  )
}
