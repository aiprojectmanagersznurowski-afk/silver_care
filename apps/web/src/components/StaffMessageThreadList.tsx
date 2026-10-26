'use client'

import React from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { MessageSquare, Clock, AlertCircle, RefreshCw } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { SearchField } from '@/components/patterns/ListToolbar'
import { isThreadAwaitingReply, type MessageThread } from '@/lib/messages-helper'

interface StaffMessageThreadListProps {
  threads: MessageThread[]
  activeThreadId: string | null
  onSelect: (threadId: string) => void
  relativeLabelOf: (thread: MessageThread) => string
  searchQuery: string
  onSearchChange: (q: string) => void
  onlyAwaiting: boolean
  onToggleAwaiting: () => void
  awaitingCount: number
  onRefresh: () => void
  initialLoading: boolean
  refreshing: boolean
  error: string | null
}

const initials = (name: string) => name.split(' ').map((n) => n[0]).join('')

/** Lista wątków: wyszukiwanie, filtr „Do odpowiedzi”, odświeżanie; przy wątku rola bliskiego, który pisze. */
export function StaffMessageThreadList(props: StaffMessageThreadListProps) {
  const { threads, activeThreadId, onSelect, relativeLabelOf, onlyAwaiting, awaitingCount } = props

  return (
    <>
      {/* Nagłówek strony opisuje widok; tu tylko wyszukiwanie, filtr i odświeżanie wątków */}
      <div data-testid="message-threads-toolbar" className="space-y-2 border-b border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchField value={props.searchQuery} onChange={props.onSearchChange} label="Szukaj wątku" placeholder="Szukaj podopiecznego lub treści..." />
          </div>
          <button
            type="button"
            onClick={props.onRefresh}
            disabled={props.refreshing}
            aria-label="Odśwież wiadomości"
            title="Odśwież wiadomości"
            className="inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${props.refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <button
          type="button"
          aria-pressed={onlyAwaiting}
          onClick={props.onToggleAwaiting}
          className={`inline-flex min-h-touch items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            onlyAwaiting ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-foreground hover:bg-muted/50'
          }`}
        >
          Tylko do odpowiedzi
          <span className="rounded-full bg-muted px-2 text-sm text-foreground">{awaitingCount}</span>
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border" data-testid="message-threads-list">
        {props.initialLoading && threads.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground space-y-2">
            <RefreshCw className="h-5 w-5 animate-spin text-primary mx-auto" />
            <p>Ładowanie wątków...</p>
          </div>
        ) : props.error && threads.length === 0 ? (
          <div className="p-6 text-center text-sm text-destructive space-y-2">
            <AlertCircle className="h-5 w-5 mx-auto" />
            <p>{props.error}</p>
            <button onClick={props.onRefresh} className="mt-2 text-sm font-semibold underline text-foreground">Spróbuj ponownie</button>
          </div>
        ) : threads.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground" data-testid="messages-empty-state">
            <p className="font-medium text-foreground">Brak wiadomości</p>
            <p className="mt-1">
              {props.searchQuery ? 'Brak wyników pasujących do wyszukiwania.' : onlyAwaiting ? 'Wszystkie wątki mają odpowiedź.' : 'Nie ma jeszcze wiadomości od rodzin.'}
            </p>
          </div>
        ) : (
          threads.map((thread) => {
            const isSelected = activeThreadId === thread.threadId
            const lastMsg = thread.lastMessage
            return (
              <button
                key={thread.threadId}
                data-testid="thread-item"
                onClick={() => onSelect(thread.threadId)}
                className={`w-full text-left p-4 transition-all flex items-start gap-3 border-l-4 ${isSelected ? 'bg-card border-primary' : 'border-transparent hover:bg-card/60'}`}
              >
                <Avatar className="h-10 w-10 shrink-0 border border-border">
                  <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">{initials(thread.residentName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span data-testid="thread-resident" className="font-semibold text-sm text-foreground truncate">{thread.residentName}</span>
                    <span className="text-sm text-muted-foreground whitespace-nowrap flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      {format(new Date(lastMsg.created_at), 'd MMM, HH:mm', { locale: pl })}
                    </span>
                  </div>
                  <div className="mb-1 flex items-center gap-2 min-w-0">
                    <span data-testid="thread-relative" className="text-sm text-muted-foreground truncate">{relativeLabelOf(thread)}</span>
                    <BusinessIdBadge type="user" id={thread.relativeUserId} />
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {lastMsg.is_from_family ? <span className="font-medium text-foreground">Rodzina: </span> : <span className="font-medium text-primary">Personel: </span>}
                    {lastMsg.content}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
                      <MessageSquare className="h-3 w-3 text-muted-foreground" />
                      {thread.messages.length} {thread.messages.length === 1 ? 'wiadomość' : 'wiadomości'}
                    </span>
                    {isThreadAwaitingReply(thread) && <StatusBadge tone="brand">Do odpowiedzi</StatusBadge>}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </>
  )
}
