'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { MessageSquare, Clock, AlertCircle, RefreshCw, ChevronLeft } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { groupMessagesIntoThreads, filterThreadsBySearch, RawMessage } from '@/lib/messages-helper'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { StaffMessageList } from './StaffMessageList'
import { StaffMessageComposer } from './StaffMessageComposer'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { SearchField } from '@/components/patterns/ListToolbar'

interface StaffMessagesInboxProps {
  initialResidentId?: string
}

export function StaffMessagesInbox({ initialResidentId }: StaffMessagesInboxProps) {
  const [messages, setMessages] = useState<RawMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchMessages = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/admin/messages')
      if (!res.ok) throw new Error('Nie udało się pobrać wiadomości')
      const data = await res.json()
      const fetched: RawMessage[] = data.messages || []
      setMessages(fetched)

      if (fetched.length > 0) {
        const grouped = groupMessagesIntoThreads(fetched)
        if (initialResidentId) {
          const match = grouped.find((t) => t.residentId === initialResidentId)
          setActiveThreadId(match ? match.threadId : grouped[0]?.threadId || null)
        } else if (!activeThreadId && grouped.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
          setActiveThreadId(grouped[0].threadId)
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Wystąpił błąd podczas ładowania')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => fetchMessages())
    const interval = setInterval(fetchMessages, 30000)
    return () => clearInterval(interval)
  }, [initialResidentId])

  const threads = useMemo(() => groupMessagesIntoThreads(messages), [messages])
  const filteredThreads = useMemo(() => filterThreadsBySearch(threads, searchQuery), [threads, searchQuery])
  const activeThread = useMemo(() => threads.find((t) => t.threadId === activeThreadId) || null, [threads, activeThreadId])
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [activeThread?.messages, activeThreadId])

  const handleSendReply = async () => {
    if (!replyText.trim() || !activeThread || isSending) return
    setIsSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resident_id: activeThread.residentId,
          relative_user_id: activeThread.relativeUserId,
          content: replyText.trim(),
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Nie udało się wysłać odpowiedzi')
      }
      setReplyText('')
      await fetchMessages()
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('staff-messages-updated'))
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Błąd podczas wysyłania wiadomości')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-background/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground font-display">Skrzynka wiadomości placówki</h3>
            <p className="text-sm text-muted-foreground">Bezpośrednia komunikacja z bliskimi pensjonariuszy placówki.</p>
          </div>
        </div>
        <button
          onClick={fetchMessages}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50 min-h-touch"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Odśwież
        </button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <div className={`${activeThreadId ? 'hidden md:flex' : 'flex'} w-full md:w-96 border-r border-border flex-col bg-muted/50 shrink-0 min-h-0`}>
          <div className="p-3 border-b border-border bg-card">
            <SearchField value={searchQuery} onChange={setSearchQuery} label="Szukaj wątku" placeholder="Szukaj podopiecznego lub treści..." />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border" data-testid="message-threads-list">
            {loading && threads.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground space-y-2">
                <RefreshCw className="h-5 w-5 animate-spin text-primary mx-auto" />
                <p>Ładowanie wątków...</p>
              </div>
            ) : error && threads.length === 0 ? (
              <div className="p-6 text-center text-sm text-destructive space-y-2">
                <AlertCircle className="h-5 w-5 mx-auto" />
                <p>{error}</p>
                <button onClick={fetchMessages} className="mt-2 text-sm font-semibold underline text-foreground">Spróbuj ponownie</button>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground" data-testid="messages-empty-state">
                <p className="font-medium text-foreground">Brak wiadomości</p>
                <p className="mt-1">{searchQuery ? 'Brak wyników pasujących do wyszukiwania.' : 'Nie ma jeszcze wiadomości od rodzin.'}</p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = activeThreadId === thread.threadId
                const lastMsg = thread.lastMessage
                return (
                  <button
                    key={thread.threadId}
                    data-testid="thread-item"
                    onClick={() => { setActiveThreadId(thread.threadId); setSendError(null) }}
                    className={`w-full text-left p-4 transition-all flex items-start gap-3 border-l-4 ${isSelected ? 'bg-card border-primary' : 'border-transparent hover:bg-card/60'}`}
                  >
                    <Avatar className="h-10 w-10 shrink-0 border border-border">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">{thread.residentName.split(' ').map((n) => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-semibold text-sm text-foreground truncate">{thread.residentName}</span>
                        <span className="text-sm text-muted-foreground whitespace-nowrap flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {format(new Date(lastMsg.created_at), 'd MMM, HH:mm', { locale: pl })}
                        </span>
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
                        {lastMsg.is_from_family && (
                          <StatusBadge tone="brand">Do odpowiedzi</StatusBadge>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className={`w-full flex md:flex-1 flex-col bg-card min-w-0 min-h-0 ${activeThreadId ? '' : 'hidden md:flex'}`}>
          {activeThread ? (
            <>
              <div data-testid="conversation-header" className="px-4 md:px-6 py-4 border-b border-border flex items-center justify-between bg-card">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setActiveThreadId(null)}
                    className="md:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border bg-muted/50 hover:bg-muted text-sm font-medium text-foreground transition-colors mr-1 shrink-0"
                    aria-label="Wróć do listy wątków"
                  >
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                    <span>Wszystkie wątki</span>
                  </button>
                  <Avatar className="h-10 w-10 border border-border shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                      {activeThread.residentName.split(' ').map((n) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-foreground truncate">{activeThread.residentName}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 truncate">
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      Wątek wiadomości z rodziną podopiecznego
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="hidden sm:inline-block">
                    <BusinessIdBadge type="resident" id={activeThread.residentId} />
                  </div>
                </div>
              </div>

              <StaffMessageList messages={activeThread.messages} scrollRef={scrollRef} />

              <StaffMessageComposer
                replyText={replyText}
                setReplyText={setReplyText}
                onSendReply={handleSendReply}
                isSending={isSending}
                sendError={sendError}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" data-testid="messages-empty-state">
              <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h4 className="font-semibold text-sm text-foreground font-display">Wybierz wątek z listy</h4>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                Wybierz podopiecznego z lewego menu, aby zobaczyć historię wiadomości od rodziny i wysłać odpowiedź.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
