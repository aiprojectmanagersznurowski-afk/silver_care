'use client'

import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Maximize2 } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { useSendFamilyMessage } from '../hooks/useSendFamilyMessage';
import { format, isSameDay } from 'date-fns';
import { pl } from 'date-fns/locale';

interface Message {
  id: string;
  content: string;
  created_at: string;
  resident_id: string;
  is_from_family: boolean;
}

export function CommunicationWidget({ residentId }: { residentId?: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  
  const { sendMessage, state: sendState, error: sendError } = useSendFamilyMessage(residentId || "");
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    if (!residentId) return;
    try {
      const res = await fetch('/api/messages');
      const data = await res.json();
      if (data.messages) {
        const relevant = data.messages.filter((m: Message) => m.resident_id === residentId);
        setMessages(relevant);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (open) {
      loadMessages();
      const interval = setInterval(loadMessages, 30000);
      return () => clearInterval(interval);
    }
  }, [residentId, open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const handleSubmit = async () => {
    if (!draft.trim() || !residentId) return;
    
    const ok = await sendMessage(draft);
    if (ok) {
      setDraft('');
      await loadMessages();
    }
  };

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end sm:bottom-6 sm:right-6">
      {open && (
        <div className="mb-3 flex h-[540px] w-[370px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[1.5rem] bg-card shadow-2xl ring-1 ring-border sm:max-w-[calc(100vw-3rem)]">
          {/* header */}
          <div className="flex items-center justify-between bg-sage px-5 py-4 text-primary-foreground">
            <div className="leading-tight">
              <p className="text-[1.1rem] font-medium">Zespół opieki</p>
              <p className="flex items-center gap-1.5 text-[0.78rem] opacity-90">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Silver Care · kontakt z placówką
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/messages"
                title="Otwórz pełny widok wiadomości"
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15 transition-colors text-white"
              >
                <Maximize2 className="h-4 w-4" />
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* body */}
          <div className="flex-1 flex flex-col overflow-y-auto p-4 bg-surface-sunken" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-center px-4 py-8">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4 bg-sage-soft text-sage-deep">
                  💬
                </div>
                <p className="text-sm font-medium text-slate">
                  Napisz wiadomość do personelu opiekuńczego.
                </p>
                <p className="text-xs text-slate-soft mt-1 max-w-[220px]">
                  Odpowiedź pojawi się bezpośrednio w tym oknie oraz w zakładce Wiadomości.
                </p>
              </div>
            ) : (
              <div className="mt-auto flex flex-col space-y-4">
                {messages.map((m, idx) => {
                  const isFamily = m.is_from_family;
                  const prevMsg = messages[idx - 1];
                  const showTime = !prevMsg || !isSameDay(new Date(m.created_at), new Date(prevMsg.created_at));

                  return (
                    <div key={m.id} className="flex flex-col">
                      {showTime && (
                        <div className="flex justify-center my-4">
                          <span className="text-[10px] font-semibold text-slate-soft uppercase tracking-wider bg-card px-2 py-0.5 rounded-full border border-border">
                            {format(new Date(m.created_at), "EEEE, d MMMM, HH:mm", { locale: pl })}
                          </span>
                        </div>
                      )}
                      
                      {isFamily ? (
                        <div className="flex flex-col items-end">
                          <div className="max-w-[80%] rounded-2xl rounded-br-md bg-sage px-4 py-2.5 text-primary-foreground shadow-sm">
                            <p className="text-[0.92rem] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                          </div>
                          <span className="mt-1 text-[0.7rem] text-slate-soft">{format(new Date(m.created_at), "HH:mm")}</span>
                        </div>
                      ) : (
                        <div className="flex gap-2.5">
                          <Avatar className="mt-0.5 h-8 w-8">
                            <AvatarFallback className="bg-sage-soft text-sage font-medium text-xs">SC</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-card px-4 py-2.5 shadow-sm border border-border">
                              <p className="text-[0.92rem] leading-relaxed text-slate whitespace-pre-wrap">{m.content}</p>
                            </div>
                            <span className="ml-1 mt-1 block text-[0.7rem] text-slate-soft">
                              Personel · {format(new Date(m.created_at), "HH:mm")}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* composer */}
          <div className="border-t border-border p-3 bg-card">
            <div className="flex flex-col gap-1">
              <div className="flex items-end gap-2 rounded-2xl bg-muted/40 px-3 py-2 border border-border/60">
                <textarea
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Napisz do zespołu opieki…"
                  className="max-h-24 flex-1 resize-none bg-transparent py-1.5 text-[0.92rem] text-slate outline-none placeholder:text-slate-soft"
                />
                <button
                  onClick={handleSubmit}
                  disabled={sendState === 'loading' || !draft.trim()}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                    draft.trim() && sendState !== 'loading'
                      ? "bg-sage text-primary-foreground hover:scale-105 shadow-sm" 
                      : "bg-muted text-slate-soft cursor-not-allowed opacity-60"
                  }`}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              {sendError && (
                <p className="px-2 pt-1 text-xs text-destructive font-medium animate-in fade-in">
                  {sendError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-sage text-primary-foreground shadow-xl transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X className="h-6 w-6 sm:h-7 sm:w-7" /> : <MessageCircle className="h-6 w-6 sm:h-7 sm:w-7" />}
      </button>
    </div>
  );
}
