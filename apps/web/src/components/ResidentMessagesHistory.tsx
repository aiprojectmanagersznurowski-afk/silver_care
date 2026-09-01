import React, { useEffect, useState } from 'react';
import { UIState } from '@silvercare/contracts/src/generated/presentation';

interface FamilyMessage {
  id: string;
  content: string;
  created_at: string;
  relative_user_id: string;
}

interface ResidentMessagesHistoryProps {
  residentId: string;
}

export function ResidentMessagesHistory({ residentId }: ResidentMessagesHistoryProps) {
  const [state, setState] = useState<UIState>('loading');
  const [messages, setMessages] = useState<FamilyMessage[]>([]);

  useEffect(() => {
    fetch(`/api/admin/residents/${residentId}/messages`)
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
  }, [residentId]);

  if (state === 'loading') return <div>Ładowanie historii wiadomości...</div>;
  if (state === 'error') return <div className="text-red-500">Błąd podczas pobierania historii.</div>;
  if (state === 'empty') return <div>Brak historii wiadomości dla tego pensjonariusza.</div>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Historia wiadomości od rodziny</h3>
      <ul className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-md">
        {messages.map(msg => (
          <li key={msg.id} className="p-4 hover:bg-gray-50">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase">Wiadomość z zewnątrz</span>
              <span className="text-sm text-gray-400">{new Date(msg.created_at).toLocaleString()}</span>
            </div>
            <p className="text-sm text-gray-800">{msg.content}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
