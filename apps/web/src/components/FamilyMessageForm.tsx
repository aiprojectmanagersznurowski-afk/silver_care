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
    await sendMessage(content);
    
    if (sendState !== 'error') {
      setContent('');
      // Optimistic update lub proste zaciągnięcie
      await loadMessages();
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white dark:bg-card rounded-2xl overflow-hidden relative" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.02)" }}>
      
      {/* Okno czatu */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 pb-20"
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
            <div className="w-16 h-16 rounded-full bg-surface-sunken mb-4 flex items-center justify-center text-2xl">
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
                <div className={`flex flex-col max-w-[75%] ${isFamily ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                  <div 
                    className={`px-4 py-2.5 text-[15px] leading-snug shadow-sm ${
                      isFamily 
                        ? 'bg-primary text-white rounded-2xl rounded-tr-sm' 
                        : 'bg-surface-sunken dark:bg-muted text-foreground rounded-2xl rounded-tl-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <span className="text-[10px] text-text-tertiary mt-1 mx-1">
                    {format(new Date(msg.created_at), "HH:mm")} • {isFamily ? 'Ty' : 'Personel'}
                  </span>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Formularz wprowadzania */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/80 dark:bg-card/80 backdrop-blur-xl border-t border-border/50">
        <form 
          onSubmit={handleSubmit} 
          className="flex items-end gap-2 bg-surface-sunken dark:bg-muted rounded-2xl px-1.5 py-1.5 border border-border/50 transition-shadow focus-within:ring-2 focus-within:ring-primary/20"
        >
          <textarea
            className="flex-1 max-h-[120px] bg-transparent px-3 py-2 text-[15px] text-foreground placeholder:text-text-tertiary focus:outline-none resize-y self-center min-h-[40px]"
            rows={1}
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
          <button
            type="submit"
            disabled={sendState === 'loading' || !content.trim()}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-50 disabled:bg-primary/50 transition-colors mb-0.5"
          >
            <SendHorizontal className="w-4 h-4 ml-0.5" />
          </button>
        </form>
        
        {sendState === 'error' && sendError && (
          <div className="mt-2 text-center text-[11px] text-destructive font-medium">
            {sendError}
          </div>
        )}
      </div>
    </div>
  );
}
