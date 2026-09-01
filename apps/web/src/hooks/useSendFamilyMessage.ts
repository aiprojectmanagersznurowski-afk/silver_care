import { useState } from 'react';
import { UIState } from '@silvercare/contracts/src/generated/presentation';

export function useSendFamilyMessage(residentId: string) {
  const [state, setState] = useState<UIState>('empty');
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (content: string) => {
    setState('loading');
    setError(null);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resident_id: residentId, content })
      });

      if (!res.ok) {
        const data = await res.json();
        // If it's a 429, we display the user-friendly message from the API.
        throw new Error(data.error || 'Wystąpił błąd podczas wysyłania wiadomości.');
      }

      setState('success');
    } catch (err: any) {
      setError(err.message);
      setState('error');
    }
  };

  const resetState = () => {
    setState('empty');
    setError(null);
  };

  return { sendMessage, state, error, resetState };
}
