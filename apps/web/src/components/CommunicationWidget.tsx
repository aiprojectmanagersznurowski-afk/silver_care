'use client'

import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, StickyNote, MessageSquareText } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useSendFamilyMessage } from '../hooks/useSendFamilyMessage';
import { format, isSameDay } from 'date-fns';
import { pl } from 'date-fns/locale';

type Tab = "chat" | "notes";

interface Message {
  id: string;
  content: string;
  created_at: string;
  resident_id: string;
  is_from_family: boolean;
}

const mockNotes = [
  { id: 1, text: "Proszę przypomnieć mamie o okularach do czytania podczas obiadu.", author: "Ty", time: "Wczoraj" },
  { id: 2, text: "Wieczorami woli herbatę rumiankową.", author: "Ty", time: "Pon" },
];

export function CommunicationWidget({ residentId }: { residentId?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [draft, setDraft] = useState("");
  
  const { sendMessage, state: sendState } = useSendFamilyMessage(residentId || "");
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
  }, [messages, tab, open]);

  const handleSubmit = async () => {
    if (!draft.trim() || !residentId) return;
    if (tab === 'notes') {
        // Here we could save a note instead of a chat message, but for now we just clear it
        setDraft("");
        return;
    }
    
    await sendMessage(draft);
    if (sendState !== 'error') {
      setDraft('');
      await loadMessages();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end sm:bottom-6 sm:right-6">
      {open && (
        <div className="mb-3 flex h-[540px] w-[370px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[1.5rem] bg-card shadow-2xl ring-1 ring-border sm:max-w-[calc(100vw-3rem)]">
          {/* header */}
          <div className="flex items-center justify-between bg-sage px-5 py-4 text-primary-foreground">
            <div className="leading-tight">
              <p className="text-[1.1rem]">Zespół opieki</p>
              <p className="flex items-center gap-1.5 text-[0.78rem] opacity-90">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Silver Care · dostępny
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* tabs */}
          <div className="flex gap-1 border-b border-border p-2">
            {(
              [
                { id: "chat", label: "Czat", icon: MessageSquareText },
                { id: "notes", label: "Notatki dla personelu", icon: StickyNote },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 transition-colors ${
                  tab === t.id ? "bg-sage-soft text-sage-deep" : "text-slate-soft hover:bg-muted/60"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>

          {/* body */}
          <div className="flex-1 flex flex-col overflow-y-auto p-4" ref={scrollRef}>
            {tab === "chat" ? (
              messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 text-center px-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4 bg-muted">
                    👋
                  </div>
                  <p className="text-[13px] text-slate-soft">
                    Napisz wiadomość do personelu.<br/>Odpiszemy najszybciej jak to możliwe.
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
                          <span className="text-[10px] font-semibold text-slate-soft uppercase tracking-wider">
                            {format(new Date(m.created_at), "EEEE, d MMMM, HH:mm", { locale: pl })}
                          </span>
                        </div>
                      )}
                      
                      {isFamily ? (
                        <div className="flex flex-col items-end">
                          <div className="max-w-[80%] rounded-2xl rounded-br-md bg-sage px-4 py-2.5 text-primary-foreground">
                            <p className="text-[0.92rem] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                          </div>
                          <span className="mt-1 text-[0.7rem] text-slate-soft">{format(new Date(m.created_at), "HH:mm")}</span>
                        </div>
                      ) : (
                        <div className="flex gap-2.5">
                          <Avatar className="mt-0.5 h-8 w-8">
                            <AvatarFallback className="bg-sage-soft text-sage font-medium">SC</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted px-4 py-2.5">
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
              )
            ) : (
              <div className="space-y-4">
                {mockNotes.map((n) => (
                  <div key={n.id} className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
                    <p className="text-[0.92rem] leading-relaxed text-slate">{n.text}</p>
                    <p className="mt-2 text-[0.72rem] text-slate-soft">
                      {n.author} · {n.time}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* composer */}
          <div className="border-t border-border p-3 bg-white">
            <div className="flex items-end gap-2 rounded-2xl bg-muted/50 px-3 py-2 border border-border/50">
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
                placeholder={tab === "chat" ? "Napisz do zespołu opieki…" : "Zostaw notatkę dla personelu…"}
                className="max-h-24 flex-1 resize-none bg-transparent py-1.5 text-[0.92rem] text-slate outline-none placeholder:text-slate-soft"
              />
              <button
                onClick={handleSubmit}
                disabled={sendState === 'loading' || !draft.trim()}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                  draft.trim() ? "bg-sage text-primary-foreground hover:scale-105 shadow-sm" : "bg-muted text-slate-soft"
                }`}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-sage text-primary-foreground shadow-xl transition-transform hover:scale-105"
      >
        {open ? <X className="h-7 w-7" /> : <MessageCircle className="h-7 w-7" />}
      </button>
    </div>
  );
}
