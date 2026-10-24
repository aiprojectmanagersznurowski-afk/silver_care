'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useSendFamilyMessage } from '../hooks/useSendFamilyMessage';
import { format, isSameDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChatBubble, ChatComposer, ChatDateSeparator, ChatSendButton, CHAT_SCROLL_AREA } from './patterns/Chat';

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
        if (typeof window !== 'undefined') {
          localStorage.setItem('silvercare_family_last_read_messages_at', new Date().toISOString());
          window.dispatchEvent(new CustomEvent('family-messages-read'));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => {
      setLoadingHistory(true);
      loadMessages();
    });
    
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
    <div className="flex flex-col h-[500px] relative bg-card rounded-xl border border-border overflow-hidden">
      
      {/* Pasek statusu kontaktu z personelem dyżurnym */}
      {messages.length > 0 && (
        <div className="px-5 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between text-sm text-muted-foreground">
          {messages[messages.length - 1]?.is_from_family ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-medium text-foreground">
                Twoja wiadomość oczekuje na odpowiedź personelu dyżurnego
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span>
                Ostatnia odpowiedź personelu:{' '}
                <strong className="font-medium text-foreground">
                  {format(new Date(messages[messages.length - 1].created_at), 'HH:mm, d MMMM', { locale: pl })}
                </strong>
              </span>
            </div>
          )}
          <span className="text-sm text-muted-foreground hidden sm:inline">
            Dyżur opiekuńczy aktywny
          </span>
        </div>
      )}

      {/* Okno czatu */}
      <div 
        ref={scrollRef}
        className={`min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-2 ${CHAT_SCROLL_AREA}`}
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
            <p className="text-sm text-text-secondary">
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
                  <ChatDateSeparator>{format(new Date(msg.created_at), "EEEE, d MMMM, HH:mm", { locale: pl })}</ChatDateSeparator>
                )}
                <ChatBubble
                  own={isFamily}
                  meta={<>
                    {format(new Date(msg.created_at), "HH:mm")} • {isFamily ? 'Ty' : 'Personel dyżurny'}
                    {isFamily && <span className="ml-1 font-medium text-primary">✓ Doręczono do dyżurki</span>}
                  </>}
                >
                  {msg.content}
                </ChatBubble>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Komunikat o błędzie (np. limit wiadomości) */}
      {sendState === 'error' && sendError && (
        <div className="absolute bottom-[72px] left-4 right-4 bg-destructive/10 border border-destructive/20 rounded-xl p-2.5 text-center text-sm text-destructive font-medium z-20 animate-in fade-in slide-in-from-bottom-2">
          {sendError}
        </div>
      )}

      {/* Formularz wprowadzania */}
      <form onSubmit={handleSubmit}>
        <ChatComposer after={<ChatSendButton disabled={sendState === 'loading' || !content.trim()} loading={sendState === 'loading'} />}>
          <input
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            aria-label="Wiadomość do personelu"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Napisz wiadomość..."
            disabled={sendState === 'loading'}
          />
        </ChatComposer>
      </form>
    </div>
  );
}
