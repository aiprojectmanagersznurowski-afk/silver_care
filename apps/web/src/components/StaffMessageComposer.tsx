'use client'

import React from 'react'
import { RefreshCw, ShieldAlert, CornerDownRight, Mic, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import { ChatComposer, ChatSendButton } from './patterns/Chat'
import { shouldSendOnEnter } from '@/lib/message-threads'

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
    purpose: 'staff_message',
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
    <div className="shrink-0">
      {(isRecording || isTranscribing || sendError) && (
        <div className="space-y-2 border-t border-border bg-background px-4 pt-3">
          {isRecording && (
            <div
              data-testid="voice-recording-indicator"
              className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 p-2.5 text-sm text-primary"
            >
              <span className="size-2 rounded-full bg-primary" />
              <span className="font-semibold">Nagrywanie odpowiedzi głosowej... ({duration}s)</span>
            </div>
          )}
          {isTranscribing && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 p-2.5 text-sm text-primary">
              <RefreshCw className="size-4 animate-spin" />
              <span>Przetwarzanie i transkrypcja odpowiedzi audio...</span>
            </div>
          )}
          {sendError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-sm text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <span>{sendError}</span>
            </div>
          )}
        </div>
      )}

      <ChatComposer
        after={<>
          <button
            type="button"
            data-testid="dictate-reply-button"
            onClick={toggleVoiceRecording}
            disabled={isSending || isTranscribing}
            aria-label={isRecording ? 'Zatrzymaj nagrywanie' : 'Podyktuj odpowiedź'}
            className={`inline-flex size-touch shrink-0 items-center justify-center rounded-full border transition-colors ${
              isRecording
                ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border-border bg-background text-foreground hover:bg-muted disabled:text-muted-foreground'
            }`}
          >
            {isTranscribing ? (
              <RefreshCw className="size-4 animate-spin text-primary" />
            ) : isRecording ? (
              <Square className="size-3.5 fill-current" />
            ) : (
              <Mic className="size-4 text-primary" />
            )}
          </button>
          <ChatSendButton disabled={isSending || !replyText.trim()} loading={isSending} onClick={onSendReply} />
        </>}
      >
        <Textarea
          rows={1}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Wpisz lub podyktuj odpowiedź do rodziny podopiecznego..."
          aria-label="Odpowiedź do rodziny"
          onKeyDown={(e) => {
            // Na ekranie dotykowym Enter to nowa linia — wysyła tylko przycisk
            const isCoarsePointer = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
            if (shouldSendOnEnter(e, isCoarsePointer)) {
              e.preventDefault()
              onSendReply()
            }
          }}
          className="max-h-40 min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </ChatComposer>
      <p className="flex items-center gap-1 bg-background px-5 pb-2 text-xs text-muted-foreground">
        <CornerDownRight className="size-3" />
        Na komputerze Enter wysyła odpowiedź, a Shift+Enter tworzy nową linię. Na telefonie użyj przycisku wysyłania.
      </p>
    </div>
  )
}
