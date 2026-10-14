'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  RawMessage, 
  MessageThread, 
  getAwaitingThreads 
} from '@/lib/messages-helper';

/**
 * @REQ: FAM-MESSAGES
 * @REQ: NUR-BOARD
 *
 * Hook do monitorowania oczekujących wiadomości od rodzin w panelu personelu.
 */
export function useStaffUnansweredMessages() {
  const [awaitingThreads, setAwaitingThreads] = useState<MessageThread[]>([]);
  const [unansweredCount, setUnansweredCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchUnanswered = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/messages');
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      const messages: RawMessage[] = data.messages || [];
      const awaiting = getAwaitingThreads(messages);
      const totalUnread = awaiting.reduce((acc, t) => acc + (t.unreadCount || 1), 0);
      
      setAwaitingThreads(awaiting);
      setUnansweredCount(totalUnread);
    } catch {
      // Ciche niepowodzenie w tle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnanswered();

    const interval = setInterval(fetchUnanswered, 30000);

    const handleUpdate = () => {
      fetchUnanswered();
    };

    window.addEventListener('staff-messages-updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('staff-messages-updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, [fetchUnanswered]);

  return {
    awaitingThreads,
    unansweredCount,
    loading,
    refresh: fetchUnanswered,
  };
}
