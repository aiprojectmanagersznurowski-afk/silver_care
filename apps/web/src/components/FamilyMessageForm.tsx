import React, { useState } from 'react';
import { useSendFamilyMessage } from '../hooks/useSendFamilyMessage';

interface FamilyMessageFormProps {
  residentId: string;
}

export function FamilyMessageForm({ residentId }: FamilyMessageFormProps) {
  const { sendMessage, state, error, resetState } = useSendFamilyMessage(residentId);
  const [content, setContent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    await sendMessage(content);
    if (state === 'success' || state === 'empty') {
      setContent('');
    }
  };

  if (state === 'success') {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-800" role="alert">
        <p>Wiadomość została wysłana do personelu. Dziękujemy.</p>
        <button 
          onClick={resetState}
          className="mt-2 text-sm font-semibold underline text-green-700"
        >
          Wyślij kolejną wiadomość
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-3">
      <label htmlFor="message-content" className="text-sm font-medium text-gray-700">
        Zostaw wiadomość dla personelu (bez dzwonienia na dyżurkę)
      </label>
      <textarea
        id="message-content"
        className="border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={4}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Wpisz treść wiadomości..."
        disabled={state === 'loading'}
        aria-invalid={state === 'error' ? 'true' : 'false'}
        aria-describedby={state === 'error' ? 'message-error' : undefined}
      />
      
      {state === 'error' && error && (
        <p id="message-error" className="text-sm text-red-600 bg-red-50 p-2 rounded-md border border-red-200" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'loading' || !content.trim()}
        className="self-end px-4 py-2 bg-blue-600 text-white rounded-md font-medium disabled:opacity-50"
      >
        {state === 'loading' ? 'Wysyłanie...' : 'Wyślij wiadomość'}
      </button>
    </form>
  );
}
