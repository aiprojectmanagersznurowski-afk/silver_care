'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useSendFamilyMessage } from '../hooks/useSendFamilyMessage';
import { format, isSameDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { SendHorizontal } from 'lucide-react';

interface FamilyMessageFormProps {
  residentId: string;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  resident_id: string;
  is_from_family: boolean;
}

export function FamilyMessageForm({ residentId }: FamilyMessageFormProps) {
  const { sendMessage, state: sendState, error: sendError } = useSendFamilyMessage(residentId);
  const [content, setContent] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    try {
      const res = await fetch('/api/messages');
      const data = await res.json();
      if (data.messages) {
        // Filtracja po wybranym podopiecznym, o ile API tego nie zrobiło (chronologicznie = od najstarszych do najnowszych)
        const relevant = data.messages.filter((m: Message) => m.resident_id === residentId);
        setMessages(relevant);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    setLoadingHistory(true);
    loadMessages();
    
    // Proste odświeżanie co 30 sekund (pseudo real-time)
    const interval = setInterval(loadMessages, 30000);
    return () => clearInterval(interval);
  }, [residentId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    const ok = await sendMessage(content);
    
    if (ok) {
      setContent('');
      // Optimistic update lub proste zaciągnięcie
      await loadMessages();
    }
  };

  return (
    <div className="flex flex-col h-[500px] relative bg-card rounded-2xl border border-border overflow-hidden">
      
      {/* Okno czatu */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-4 space-y-2 pb-20 bg-surface-sunken"
      >
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0.15s" }} />
              <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0.3s" }} />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4 bg-surface border border-border">
              👋
            </div>
            <p className="text-[13px] text-text-secondary">
              Napisz wiadomość do personelu.<br/>Odpiszemy najszybciej jak to możliwe.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isFamily = msg.is_from_family;
            const prevMsg = messages[idx - 1];
            const showTime = !prevMsg || !isSameDay(new Date(msg.created_at), new Date(prevMsg.created_at));

            return (
              <React.Fragment key={msg.id}>
                {showTime && (
                  <div className="flex justify-center my-4">
                    <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
                      {format(new Date(msg.created_at), "EEEE, d MMMM, HH:mm", { locale: pl })}
                    </span>
                  </div>
                )}
                <div className={`flex flex-col ${isFamily ? 'items-end' : 'items-start'}`}>
                  <div 
                    className={`max-w-[78%] px-4 py-2.5 rounded-2xl shadow-sm ${
                      isFamily 
                        ? 'bg-primary text-primary-foreground rounded-br-sm' 
                        : 'bg-card text-foreground border border-border rounded-bl-sm'
                    }`}
                  >
                    <p className="text-[14px] leading-relaxed font-normal whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 px-1">
                    <span className="text-[10px] text-text-secondary">
                      {format(new Date(msg.created_at), "HH:mm")} • {isFamily ? 'Ty' : 'Personel'}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Komunikat o błędzie (np. limit wiadomości) */}
      {sendState === 'error' && sendError && (
        <div className="absolute bottom-[64px] left-4 right-4 bg-destructive/10 border border-destructive/20 rounded-xl p-2.5 text-center text-[12px] text-destructive font-medium shadow-sm z-20 animate-in fade-in slide-in-from-bottom-2">
          {sendError}
        </div>
      )}

      {/* Formularz wprowadzania */}
      <div
        className="absolute bottom-0 left-0 right-0 px-4 py-3 flex items-center gap-3 bg-surface/90 backdrop-blur-md border-t border-border"
      >
        <div
          className="flex-1 flex items-center rounded-full px-4 py-2.5 bg-background border border-border shadow-sm"
        >
          <input
            className="flex-1 text-[14px] font-normal bg-transparent text-foreground outline-none"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Napisz wiadomość..."
            disabled={sendState === 'loading'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={sendState === 'loading' || !content.trim()}
          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90 ${
            content.trim() ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
