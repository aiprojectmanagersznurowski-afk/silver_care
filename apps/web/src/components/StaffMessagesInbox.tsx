'use client'

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { MessageSquare, ChevronLeft } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { groupMessagesIntoThreads, filterThreadsBySearch, RawMessage, type MessageThread } from '@/lib/messages-helper'
import {
  countAwaitingReply,
  filterAwaitingReply,
  keepSelectedThread,
  latestCreatedAt,
  mergeMessages,
  relativeKey,
  relativeLabel,
  type RelativeInfo,
} from '@/lib/message-threads'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { StaffMessageList } from './StaffMessageList'
import { StaffMessageComposer } from './StaffMessageComposer'
import { StaffMessageThreadList } from './StaffMessageThreadList'

interface StaffMessagesInboxProps {
  initialResidentId?: string
}

type RelativeRow = { residentId: string; relativeUserId: string } & RelativeInfo

export function StaffMessagesInbox({ initialResidentId }: StaffMessagesInboxProps) {
  const [messages, setMessages] = useState<RawMessage[]>([])
  const [relatives, setRelatives] = useState<Map<string, RelativeInfo>>(new Map())
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [onlyAwaiting, setOnlyAwaiting] = useState(false)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Refy zamiast stanu w domknięciu: odświeżanie co 30 s widzi aktualne wiadomości i nie resetuje wyboru
  const messagesRef = useRef<RawMessage[]>([])
  const initialSelectionDone = useRef(false)

  /** `manual` pokazuje kręcącą się ikonę; odświeżanie w tle jest ciche i dociąga tylko nowe wiadomości. */
  const fetchMessages = useCallback(async (manual = false) => {
    const since = latestCreatedAt(messagesRef.current)
    try {
      if (manual) setRefreshing(true)
      setError(null)
      const res = await fetch(`/api/admin/messages${since ? `?since=${encodeURIComponent(since)}` : ''}`)
      if (!res.ok) throw new Error('Nie udało się pobrać wiadomości')
      const data = await res.json()
      const fetched: RawMessage[] = data.messages || []
      const merged = since ? mergeMessages(messagesRef.current, fetched) : fetched
      messagesRef.current = merged
      setMessages(merged)
      const rows: RelativeRow[] = data.relatives || []
      if (rows.length > 0) {
        setRelatives((prev) => {
          const next = new Map(prev)
          for (const r of rows) next.set(relativeKey(r.residentId, r.relativeUserId), { role: r.role, isPrimaryContact: r.isPrimaryContact })
          return next
        })
      }

      const grouped = groupMessagesIntoThreads(merged)
      const preferResidentId = initialSelectionDone.current ? undefined : initialResidentId
      initialSelectionDone.current = true
      const autoSelectFirst = typeof window !== 'undefined' && window.innerWidth >= 768
      setActiveThreadId((current) => keepSelectedThread(current, grouped, { preferResidentId, autoSelectFirst }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Wystąpił błąd podczas ładowania')
    } finally {
      setInitialLoading(false)
      setRefreshing(false)
    }
  }, [initialResidentId])

  useEffect(() => {
    void Promise.resolve().then(() => fetchMessages())
    const interval = setInterval(() => void fetchMessages(), 30000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  const threads = useMemo(() => groupMessagesIntoThreads(messages), [messages])
  const visibleThreads = useMemo(
    () => filterAwaitingReply(filterThreadsBySearch(threads, searchQuery), onlyAwaiting),
    [threads, searchQuery, onlyAwaiting]
  )
  const activeThread = useMemo(() => threads.find((t) => t.threadId === activeThreadId) || null, [threads, activeThreadId])
  const relativeLabelOf = useCallback(
    (t: MessageThread) => relativeLabel(relatives.get(relativeKey(t.residentId, t.relativeUserId))),
    [relatives]
  )
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
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <div className={`${activeThreadId ? 'hidden md:flex' : 'flex'} w-full md:w-96 border-r border-border flex-col bg-muted/50 shrink-0 min-h-0`}>
          <StaffMessageThreadList
            threads={visibleThreads}
            activeThreadId={activeThreadId}
            onSelect={(id) => { setActiveThreadId(id); setSendError(null) }}
            relativeLabelOf={relativeLabelOf}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onlyAwaiting={onlyAwaiting}
            onToggleAwaiting={() => setOnlyAwaiting((v) => !v)}
            awaitingCount={countAwaitingReply(threads)}
            onRefresh={() => void fetchMessages(true)}
            initialLoading={initialLoading}
            refreshing={refreshing}
            error={error}
          />
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
                    <p className="text-sm text-muted-foreground flex items-center gap-2 truncate">
                      <span>Pisze: {relativeLabelOf(activeThread)}</span>
                      <BusinessIdBadge type="user" id={activeThread.relativeUserId} />
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="hidden sm:inline-block">
                    <BusinessIdBadge type="resident" id={activeThread.residentId} />
                  </div>
                </div>
              </div>

              <StaffMessageList messages={activeThread.messages} scrollRef={scrollRef} familyLabel={relativeLabelOf(activeThread)} />

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
