'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { 
  Search, 
  Send, 
  MessageSquare, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  CornerDownRight,
  ShieldAlert,
  ChevronLeft
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { groupMessagesIntoThreads, filterThreadsBySearch } from '@/lib/messages-helper';
import { Textarea } from '@/components/ui/textarea'

interface RawMessage {
  id: string;
  content: string;
  created_at: string;
  resident_id: string;
  relative_user_id: string;
  is_from_family: boolean;
  staff_user_id?: string | null;
  residents?: {
    first_name: string;
    last_name: string;
  } | null;
}

interface StaffMessagesInboxProps {
  initialResidentId?: string;
}

export function StaffMessagesInbox({ initialResidentId }: StaffMessagesInboxProps) {
  const [messages, setMessages] = useState<RawMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/messages');
      if (!res.ok) {
        throw new Error('Nie udało się pobrać wiadomości');
      }
      const data = await res.json();
      const fetched: RawMessage[] = data.messages || [];
      setMessages(fetched);

      // Auto-select thread if initialResidentId provided or activeThreadId unset
      if (fetched.length > 0) {
        const threads = groupMessagesIntoThreads(fetched);
        if (initialResidentId) {
          const match = threads.find(t => t.residentId === initialResidentId);
          if (match) {
            setActiveThreadId(match.threadId);
          } else {
            setActiveThreadId(threads[0]?.threadId || null);
          }
        } else if (!activeThreadId && threads.length > 0) {
          if (typeof window !== 'undefined' && window.innerWidth >= 768) {
            setActiveThreadId(threads[0].threadId);
          }
        }
      }
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Wystąpił błąd podczas ładowania');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [initialResidentId]);

  const threads = useMemo(() => {
    return groupMessagesIntoThreads(messages);
  }, [messages]);

  const filteredThreads = useMemo(() => {
    return filterThreadsBySearch(threads, searchQuery);
  }, [threads, searchQuery]);

  const activeThread = useMemo(() => {
    return threads.find(t => t.threadId === activeThreadId) || null;
  }, [threads, activeThreadId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeThread?.messages, activeThreadId]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !activeThread || isSending) return;

    setIsSending(true);
    setSendError(null);

    try {
      const res = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resident_id: activeThread.residentId,
          relative_user_id: activeThread.relativeUserId,
          content: replyText.trim()
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Nie udało się wysłać odpowiedzi');
      }

      setReplyText('');
      await fetchMessages();
    } catch (err: unknown) {
      console.error(err);
      setSendError(err instanceof Error ? err.message : 'Błąd podczas wysyłania wiadomości');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[750px] bg-card rounded-xl border border-border overflow-hidden">
      {/* Pasek statusu / nagłówek wewnętrzny */}
      <div className="flex items-center justify-between border-b border-border bg-background/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground font-display">
              Skrzynka wiadomości personelu
            </h3>
            <p className="text-xs text-muted-foreground">
              Bezpośrednia komunikacja z bliskimi pensjonariuszy placówki.
            </p>
          </div>
        </div>

        <button
          onClick={fetchMessages}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Odśwież
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Lewa kolumna: Lista wątków */}
        <div 
          className={`${
            activeThreadId ? 'hidden md:flex' : 'flex'
          } w-full md:w-96 border-r border-border flex-col bg-muted/50 shrink-0`}
        >
          {/* Szukajka */}
          <div className="p-3 border-b border-border bg-card">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Szukaj podopiecznego lub treści..."
                className="w-full rounded-xl bg-muted/50 pl-9 pr-4 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary border border-transparent focus:border-primary"
              />
            </div>
          </div>

          {/* Lista wątków */}
          <div className="flex-1 overflow-y-auto divide-y divide-border" data-testid="message-threads-list">
            {loading && threads.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
                <div className="inline-block animate-spin text-primary">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <p>Ładowanie wątków...</p>
              </div>
            ) : error && threads.length === 0 ? (
              <div className="p-6 text-center text-xs text-destructive space-y-2">
                <AlertCircle className="h-5 w-5 mx-auto" />
                <p>{error}</p>
                <button
                  onClick={fetchMessages}
                  className="mt-2 text-xs font-semibold underline text-foreground"
                >
                  Spróbuj ponownie
                </button>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground" data-testid="messages-empty-state">
                <p className="font-medium text-foreground">Brak wiadomości</p>
                <p className="mt-1">
                  {searchQuery ? 'Brak wyników pasujących do wyszukiwania.' : 'Nie ma jeszcze wiadomości od rodzin.'}
                </p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = activeThreadId === thread.threadId;
                const lastMsg = thread.lastMessage;

                return (
                  <button
                    key={thread.threadId}
                    data-testid="thread-item"
                    onClick={() => {
                      setActiveThreadId(thread.threadId);
                      setSendError(null);
                    }}
                    className={`w-full text-left p-4 transition-all flex items-start gap-3 border-l-4 ${
                      isSelected
                        ? 'bg-card border-primary'
                        : 'border-transparent hover:bg-card/60'
                    }`}
                  >
                    <Avatar className="h-10 w-10 shrink-0 border border-border">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                        {thread.residentName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-semibold text-xs text-foreground truncate">
                          {thread.residentName}
                        </span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {format(new Date(lastMsg.created_at), 'd MMM, HH:mm', { locale: pl })}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground truncate">
                        {lastMsg.is_from_family ? (
                          <span className="font-medium text-foreground">Rodzina: </span>
                        ) : (
                          <span className="font-medium text-primary">Personel: </span>
                        )}
                        {lastMsg.content}
                      </p>

                      <div className="mt-2 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                          <MessageSquare className="h-3 w-3 text-muted-foreground" />
                          {thread.messages.length} {thread.messages.length === 1 ? 'wiadomość' : 'wiadomości'}
                        </span>
                        {lastMsg.is_from_family && (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            Do odpowiedzi
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Prawa kolumna: Obszar rozmowy */}
        <div 
          className={`w-full flex md:flex-1 flex-col bg-card min-w-0 ${
            activeThreadId ? '' : 'hidden md:flex'
          }`}
        >
          {activeThread ? (
            <>
              {/* Nagłówek wątku */}
              <div 
                data-testid="conversation-header"
                className="px-4 md:px-6 py-4 border-b border-border flex items-center justify-between bg-card"
              >
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setActiveThreadId(null)}
                    className="md:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border bg-muted/50 hover:bg-muted text-xs font-medium text-foreground transition-colors mr-1 shrink-0"
                    aria-label="Wróć do listy wątków"
                  >
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                    <span>Wszystkie wątki</span>
                  </button>
                  <Avatar className="h-10 w-10 border border-border shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                      {activeThread.residentName.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-foreground truncate">
                      {activeThread.residentName}
                    </h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      Wątek wiadomości z rodziną podopiecznego
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border hidden sm:inline-block">
                    ID wątku: {activeThread.residentId.slice(0, 8)}
                  </span>
                </div>
              </div>

              {/* Lista wiadomości */}
              <div
                ref={scrollRef}
                data-testid="messages-scroll-container"
                className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/50"
              >
                {activeThread.messages.map((msg, idx) => {
                  const isStaff = !msg.is_from_family;
                  const prev = activeThread.messages[idx - 1];
                  const showDate = !prev || !isSameDay(new Date(msg.created_at), new Date(prev.created_at));

                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center my-4">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-card px-3 py-1 rounded-full border border-border shadow-2xs">
                            {format(new Date(msg.created_at), 'EEEE, d MMMM yyyy', { locale: pl })}
                          </span>
                        </div>
                      )}

                      <div className={`flex flex-col ${isStaff ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`max-w-[78%] rounded-xl px-4 py-3 ${
                            isStaff
                              ? 'bg-primary text-white rounded-br-xs'
                              : 'bg-card text-foreground border border-border rounded-bl-xs'
                          }`}
                        >
                          <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 px-1">
                          <span className="text-[10px] text-muted-foreground">
                            {isStaff ? 'Personel placówki' : 'Rodzina / Opiekun'} ·{' '}
                            {format(new Date(msg.created_at), 'HH:mm')}
                          </span>
                          {isStaff && <CheckCircle2 className="h-3 w-3 text-primary" />}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Formularz odpowiedzi */}
              <div className="p-4 border-t border-border bg-card">
                {sendError && (
                  <div className="mb-3 flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
                    <span>{sendError}</span>
                  </div>
                )}

                <div className="flex gap-2 items-end bg-muted/50 rounded-xl p-2 border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                  <Textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Wpisz odpowiedź do rodziny podopiecznego..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }} className="flex-1 md:text-sm"
                  />

                  <button
                    onClick={handleSendReply}
                    disabled={isSending || !replyText.trim()}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
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
                <p className="text-[10px] text-muted-foreground mt-1.5 px-2 flex items-center gap-1">
                  <CornerDownRight className="h-3 w-3 text-muted-foreground" />
                  Wciśnij Enter, aby wysłać odpowiedź. Shift+Enter tworzy nową linię.
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" data-testid="messages-empty-state">
              <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h4 className="font-semibold text-sm text-foreground font-display">
                Wybierz wątek z listy
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Wybierz podopiecznego z lewego menu, aby zobaczyć historię wiadomości od rodziny i wysłać odpowiedź.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
