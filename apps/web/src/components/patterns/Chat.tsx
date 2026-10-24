import { Loader2, SendHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Tło przewijanej części czatu — wspólne dla portalu rodziny i skrzynki kierownika. */
export const CHAT_SCROLL_AREA = 'bg-muted/40'

/** Dymek wiadomości: własna po prawej w kolorze marki, cudza po lewej na karcie. */
export function ChatBubble({ own, meta, children }: { own: boolean; meta?: ReactNode; children: ReactNode }) {
  return (
    <div data-slot="chat-bubble" data-own={own} className={cn('flex flex-col', own ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[78%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
          own ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card text-foreground border border-border rounded-bl-sm',
        )}
      >
        {children}
      </div>
      {meta && (
        <div data-slot="chat-meta" className="mt-1 flex items-center gap-1 px-1 text-xs text-muted-foreground">
          {meta}
        </div>
      )}
    </div>
  )
}

/** Separator dnia w rozmowie — jak plakietka szablonu. */
export function ChatDateSeparator({ children }: { children: ReactNode }) {
  return (
    <div data-slot="chat-date" className="my-4 flex justify-center">
      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{children}</span>
    </div>
  )
}

/** Pasek pola wiadomości na dole czatu; dzieci to pole tekstowe i przyciski. */
export function ChatComposer({ children, after }: { children: ReactNode; after?: ReactNode }) {
  return (
    <div data-slot="chat-composer" className="shrink-0 border-t border-border bg-background px-4 py-3">
      <div className="flex items-end gap-2">
        <div
          data-slot="chat-input"
          className="flex min-h-touch flex-1 items-center rounded-2xl border border-border bg-background px-4 py-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50"
        >
          {children}
        </div>
        {after}
      </div>
    </div>
  )
}

interface ChatSendButtonProps {
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
}

/** Okrągły przycisk wysyłania (cel dotykowy z tokenu); napis „Wyślij” dla czytnika ekranu. */
export function ChatSendButton({ disabled, loading, onClick }: ChatSendButtonProps) {
  return (
    <button
      type="submit"
      data-slot="chat-send"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-touch shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
      <span className="sr-only">Wyślij</span>
    </button>
  )
}
