'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useSendFamilyMessage } from '../hooks/useSendFamilyMessage';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

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
    <div className="flex flex-col h-[500px] border border-border rounded-md overflow-hidden bg-background">
      
      {/* Okno czatu */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10"
      >
        {loadingHistory ? (
          <div className="text-center text-sm text-muted-foreground mt-10">Ładowanie historii...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground mt-10">
            Brak wiadomości. Zostaw wiadomość dla personelu placówki, np. zapytaj o samopoczucie podopiecznego.
          </div>
        ) : (
          messages.map((msg) => {
            const isFamily = msg.is_from_family;
            return (
              <div 
                key={msg.id} 
                className={`flex flex-col max-w-[80%] ${isFamily ? 'ml-auto items-end' : 'mr-auto items-start'}`}
              >
                <span className="text-[10px] text-muted-foreground mb-1 mx-1">
                  {format(new Date(msg.created_at), "d MMM, HH:mm", { locale: pl })}
                </span>
                <div 
                  className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${
                    isFamily 
                      ? 'bg-blue-600 text-white rounded-tr-sm' 
                      : 'bg-white border border-border text-foreground rounded-tl-sm dark:bg-zinc-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 mx-1">
                  {isFamily ? 'Ty' : 'Personel (Placówka)'}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Formularz wprowadzania */}
      <form 
        onSubmit={handleSubmit} 
        className="p-3 border-t border-border bg-background flex items-end gap-2"
      >
        <textarea
          className="flex-1 min-h-[44px] max-h-[120px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
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
          className="inline-flex h-[44px] items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {sendState === 'loading' ? '...' : 'Wyślij'}
        </button>
      </form>
      
      {sendState === 'error' && sendError && (
        <div className="p-2 bg-destructive/10 text-destructive text-xs text-center border-t border-border">
          {sendError}
        </div>
      )}
    </div>
  );
}
