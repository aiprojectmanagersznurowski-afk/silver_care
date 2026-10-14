'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

export interface FamilyRawMessage {
  id: string;
  content: string;
  created_at: string;
  resident_id: string;
  relative_user_id: string;
  is_from_family: boolean;
  staff_user_id?: string | null;
}

const STORAGE_KEY = 'silvercare_family_last_read_messages_at';

/**
 * @REQ: FAM-MESSAGES
 *
 * Hook zarządzający nieprzeczytanymi wiadomościami od personelu dla portalu rodziny.
 */
export function useFamilyUnreadMessages() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [recentReplies, setRecentReplies] = useState<FamilyRawMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const isAtMessagesPage = pathname?.startsWith('/messages');

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/messages');
      if (!res.ok) return;
      const data = await res.json();
      const messages: FamilyRawMessage[] = data.messages || [];

      // Wiadomości skierowane do rodziny od personelu
      const staffReplies = messages.filter((m) => !m.is_from_family);

      // Posortowane od najnowszych
      staffReplies.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      if (typeof window !== 'undefined') {
        if (isAtMessagesPage) {
          // Użytkownik jest na stronie wiadomości — oznaczamy jako przeczytane
          localStorage.setItem(STORAGE_KEY, new Date().toISOString());
          setUnreadCount(0);
          setRecentReplies(staffReplies.slice(0, 5));
          return;
        }

        const storedLastRead = localStorage.getItem(STORAGE_KEY);
        // Jeśli brak zapisanego znacznika, przyjmujemy czas sprzed 48 godzin
        const lastReadTime = storedLastRead
          ? new Date(storedLastRead).getTime()
          : Date.now() - 48 * 60 * 60 * 1000;

        const unread = staffReplies.filter(
          (m) => new Date(m.created_at).getTime() > lastReadTime
        );

        setUnreadCount(unread.length);
        setRecentReplies(staffReplies.slice(0, 5));
      }
    } catch {
      // Ignorujemy błędy w tle
    } finally {
      setLoading(false);
    }
  }, [isAtMessagesPage]);

  const markAllAsRead = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent('family-messages-read'));
    }
  }, []);

  useEffect(() => {
    fetchMessages();

    const interval = setInterval(fetchMessages, 30000);

    const handleReadEvent = () => {
      fetchMessages();
    };

    window.addEventListener('family-messages-read', handleReadEvent);
    window.addEventListener('focus', handleReadEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('family-messages-read', handleReadEvent);
      window.removeEventListener('focus', handleReadEvent);
    };
  }, [fetchMessages]);

  return {
    unreadCount,
    recentReplies,
    loading,
    refresh: fetchMessages,
    markAllAsRead,
  };
}
