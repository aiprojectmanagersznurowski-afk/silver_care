"use client";
import React, { useEffect, useState } from 'react';
import { UIState } from '@silvercare/contracts/src/generated/presentation';

interface FamilyMessage {
  id: string;
  content: string;
  created_at: string;
  resident_id: string;
  relative_user_id: string;
}

export function AdminMessagesInbox() {
  const [state, setState] = useState<UIState>('loading');
  const [messages, setMessages] = useState<FamilyMessage[]>([]);

  useEffect(() => {
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
  }, []);

  if (state === 'loading') return <div>Ładowanie wiadomości...</div>;
  if (state === 'error') return <div className="text-red-500">Błąd podczas pobierania wiadomości.</div>;
  if (state === 'empty') return <div>Brak wiadomości od rodzin.</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Skrzynka Odbiorcza - Wiadomości od Rodzin</h2>
      <ul className="divide-y divide-gray-200">
        {messages.map(msg => (
          <li key={msg.id} className="py-4">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-900">ID Pensjonariusza: {msg.resident_id}</span>
              <span className="text-sm text-gray-500">{new Date(msg.created_at).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-gray-700">{msg.content}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
