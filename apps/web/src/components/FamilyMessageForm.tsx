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
    <div className="flex flex-col h-[500px] relative" style={{ background: "#fff" }}>
      
      {/* Okno czatu */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-4 space-y-2 pb-20"
        style={{ background: "#F2F2F7" }}
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
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4" style={{ background: "#E5E5EA" }}>
              👋
            </div>
            <p className="text-[13px]" style={{ color: "#8E8E93" }}>
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
                    className="max-w-[78%] px-4 py-2.5 rounded-2xl"
                    style={{
                      background: isFamily ? "#007AFF" : "#fff",
                      color: isFamily ? "#fff" : "#1C1C1E",
                      borderBottomRightRadius: isFamily ? 6 : 18,
                      borderBottomLeftRadius: isFamily ? 18 : 6,
                      boxShadow: isFamily ? "none" : "0 1px 2px rgba(0,0,0,0.08)",
                    }}
                  >
                    <p className="text-[14px] leading-relaxed font-400 whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 px-1">
                    <span className="text-[10px]" style={{ color: "#8E8E93" }}>
                      {format(new Date(msg.created_at), "HH:mm")} • {isFamily ? 'Ty' : 'Personel'}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Formularz wprowadzania */}
      <div
        className="absolute bottom-0 left-0 right-0 px-4 py-3 flex items-center gap-3"
        style={{
          background: "rgba(242,242,247,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "0.5px solid rgba(0,0,0,0.1)",
        }}
      >
        <div
          className="flex-1 flex items-center rounded-full px-4 py-2.5"
          style={{
            background: "#fff",
            border: "0.5px solid rgba(0,0,0,0.1)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <input
            className="flex-1 text-[14px] font-400 bg-transparent outline-none"
            style={{ color: "#1C1C1E" }}
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
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
          style={{
            background: content.trim() ? "#007AFF" : "#E5E5EA",
            transition: "background 0.2s ease, transform 0.1s ease",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2L14 8L8 14" stroke={content.trim() ? "#fff" : "#8E8E93"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 8H14" stroke={content.trim() ? "#fff" : "#8E8E93"} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        {sendState === 'error' && sendError && (
          <div className="mt-2 text-center text-[11px] text-destructive font-medium">
            {sendError}
          </div>
        )}
      </div>
    </div>
  );
}
