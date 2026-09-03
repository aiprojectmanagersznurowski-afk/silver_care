"use client";
import React, { useEffect, useState, useRef } from 'react';
import { UIState } from '@silvercare/contracts/src/generated/presentation';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface FamilyMessage {
  id: string;
  content: string;
  created_at: string;
  resident_id: string;
  relative_user_id: string;
  is_from_family: boolean;
  residents?: {
    first_name: string;
    last_name: string;
  };
}

export function AdminMessagesInbox() {
  const [state, setState] = useState<UIState>('loading');
  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [activeResidentId, setActiveResidentId] = useState<string | null>(null);
  const [activeRelativeId, setActiveRelativeId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = () => {
    fetch('/api/admin/messages')
      .then(res => res.json())
      .then(data => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
          setState('success');
        } else {
          setState('empty');
        }
      })
      .catch(() => setState('error'));
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeResidentId]);

  if (state === 'loading') return <div>Ładowanie wiadomości...</div>;
  if (state === 'error') return <div className="text-red-500">Błąd podczas pobierania wiadomości.</div>;
  if (state === 'empty') return <div>Brak wiadomości od rodzin.</div>;

  // Grupujemy najnowsze wiadomości od poszczególnych "wątków" (resident + relative)
  const threads = new Map<string, FamilyMessage>();
  messages.forEach(m => {
    const threadId = `${m.resident_id}-${m.relative_user_id}`;
    if (!threads.has(threadId)) {
      threads.set(threadId, m);
    }
  });

  const threadList = Array.from(threads.values());

  const activeThreadMessages = messages
    .filter(m => m.resident_id === activeResidentId && m.relative_user_id === activeRelativeId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const handleSendReply = async () => {
    if (!replyContent.trim() || !activeResidentId || !activeRelativeId) return;
    setIsSending(true);
    
    try {
      const res = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resident_id: activeResidentId,
          relative_user_id: activeRelativeId,
          content: replyContent
        })
      });

      if (res.ok) {
        setReplyContent('');
        fetchMessages();
      } else {
        alert('Nie udało się wysłać odpowiedzi');
      }
    } catch (e) {
      alert('Błąd sieci');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex gap-6 h-[600px]">
      {/* Lista wątków */}
      <div className="w-[300px] border border-border rounded-lg overflow-y-auto bg-card flex-shrink-0">
        <div className="p-4 border-b border-border bg-muted/20">
          <h2 className="font-semibold text-lg">Skrzynka wiadomości</h2>
        </div>
        <ul className="divide-y divide-border">
          {threadList.map(msg => {
            const isActive = activeResidentId === msg.resident_id && activeRelativeId === msg.relative_user_id;
            return (
              <li 
                key={msg.id} 
                className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${isActive ? 'bg-muted' : ''}`}
                onClick={() => {
                  setActiveResidentId(msg.resident_id);
                  setActiveRelativeId(msg.relative_user_id);
                }}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-medium text-foreground truncate max-w-[160px]" title={msg.residents ? `${msg.residents.first_name} ${msg.residents.last_name}` : msg.resident_id.substring(0, 8)}>
                    {msg.residents ? `${msg.residents.first_name} ${msg.residents.last_name}` : `Pensjonariusz: ${msg.resident_id.substring(0, 8)}...`}
                  </span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2 shrink-0">
                    {format(new Date(msg.created_at), "d MMM, HH:mm", { locale: pl })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {msg.is_from_family ? 'Rodzina: ' : 'Ty: '}
                  {msg.content}
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Okno czatu */}
      <div className="flex-1 border border-border rounded-lg flex flex-col bg-background">
        {activeResidentId ? (
          <>
            <div className="p-4 border-b border-border bg-muted/20">
              <h3 className="font-semibold">Konwersacja</h3>
            </div>
            
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeThreadMessages.map(msg => {
                const isStaff = !msg.is_from_family;
                return (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col max-w-[80%] ${isStaff ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                  >
                    <span className="text-[10px] text-muted-foreground mb-1 mx-1">
                      {format(new Date(msg.created_at), "d MMM, HH:mm", { locale: pl })}
                    </span>
                    <div 
                      className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${
                        isStaff 
                          ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                          : 'bg-muted text-foreground rounded-tl-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 mx-1">
                      {isStaff ? 'Personel' : 'Rodzina'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-border bg-muted/10 flex gap-2">
              <textarea
                className="flex-1 min-h-[44px] max-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                rows={1}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Wpisz odpowiedź do rodziny..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
              />
              <button
                disabled={isSending || !replyContent.trim()}
                onClick={handleSendReply}
                className="inline-flex h-[44px] items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSending ? '...' : 'Wyślij'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Wybierz wątek z listy, aby wyświetlić i odpowiedzieć na wiadomości.
          </div>
        )}
      </div>
    </div>
  );
}
