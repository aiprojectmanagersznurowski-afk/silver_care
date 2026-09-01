import { useState, useEffect } from 'react';
import { AgendaItem } from '@/lib/agenda';

export function useAgenda(residentId: string | undefined) {
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!residentId) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/residents/${residentId}/agenda`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Wystąpił błąd podczas pobierania agendy');
        }
        return res.json();
      })
      .then((data) => {
        if (mounted) {
          setAgenda(data.agenda || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error(err);
          setError(err.message || 'Wystąpił błąd');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [residentId]);

  return { agenda, loading, error };
}
