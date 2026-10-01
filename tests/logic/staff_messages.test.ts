import { describe, it, expect } from 'vitest';

/**
 * @REQ: FAM-MESSAGES
 * @REQ: NUR-BOARD
 *
 * Testy logiki biznesowej skrzynki wiadomości personelu (Staff Messages Inbox).
 */

interface RawMessage {
  id: string;
  content: string;
  created_at: string;
  resident_id: string;
  relative_user_id: string;
  is_from_family: boolean;
  staff_user_id?: string | null;
  residents?: {
    first_name: string;
    last_name: string;
  } | null;
}

export function groupMessagesIntoThreads(messages: RawMessage[]) {
  const threadsMap = new Map<string, {
    threadId: string;
    residentId: string;
    relativeUserId: string;
    residentName: string;
    lastMessage: RawMessage;
    unreadCount: number;
    messages: RawMessage[];
  }>();

  // Sort chronologically ascending
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  for (const msg of sorted) {
    const threadId = `${msg.resident_id}-${msg.relative_user_id}`;
    const residentName = msg.residents
      ? `${msg.residents.first_name} ${msg.residents.last_name}`
      : `Podopieczny (${msg.resident_id.slice(0, 6)})`;

    if (!threadsMap.has(threadId)) {
      threadsMap.set(threadId, {
        threadId,
        residentId: msg.resident_id,
        relativeUserId: msg.relative_user_id,
        residentName,
        lastMessage: msg,
        unreadCount: msg.is_from_family ? 1 : 0,
        messages: [msg],
      });
    } else {
      const thread = threadsMap.get(threadId)!;
      thread.lastMessage = msg;
      thread.messages.push(msg);
      if (msg.is_from_family) {
        thread.unreadCount += 1;
      }
    }
  }

  // Return threads sorted by lastMessage date descending (newest activity first)
  return Array.from(threadsMap.values()).sort(
    (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
  );
}

export function filterThreadsBySearch(
  threads: ReturnType<typeof groupMessagesIntoThreads>,
  query: string
) {
  if (!query || !query.trim()) return threads;
  const q = query.toLowerCase().trim();
  return threads.filter(
    (t) =>
      t.residentName.toLowerCase().includes(q) ||
      t.messages.some((m) => m.content.toLowerCase().includes(q))
  );
}

describe('Staff Messages Inbox Logic (@REQ: FAM-MESSAGES, @REQ: NUR-BOARD)', () => {
  const sampleMessages: RawMessage[] = [
    {
      id: 'm1',
      content: 'Dzień dobry, czy mama zjadła dzisiaj obiad?',
      created_at: '2026-10-01T08:00:00Z',
      resident_id: 'res-1',
      relative_user_id: 'rel-1',
      is_from_family: true,
      residents: { first_name: 'Janina', last_name: 'Kowalska' },
    },
    {
      id: 'm2',
      content: 'Tak, zjadła cały posiłek i poszła na krótki spacer.',
      created_at: '2026-10-01T08:30:00Z',
      resident_id: 'res-1',
      relative_user_id: 'rel-1',
      is_from_family: false,
      staff_user_id: 'staff-1',
      residents: { first_name: 'Janina', last_name: 'Kowalska' },
    },
    {
      id: 'm3',
      content: 'Będziemy dzisiaj w odwiedzinach o 16:00.',
      created_at: '2026-10-01T09:00:00Z',
      resident_id: 'res-2',
      relative_user_id: 'rel-2',
      is_from_family: true,
      residents: { first_name: 'Tadeusz', last_name: 'Nowak' },
    },
  ];

  it('poprawnie grupuje wiadomości w wątki z najnowszą aktywnością na górze @REQ: FAM-MESSAGES', () => {
    const threads = groupMessagesIntoThreads(sampleMessages);

    expect(threads).toHaveLength(2);
    // res-2 ma nowszą wiadomość (09:00 vs 08:30)
    expect(threads[0].residentId).toBe('res-2');
    expect(threads[0].residentName).toBe('Tadeusz Nowak');
    expect(threads[0].messages).toHaveLength(1);

    expect(threads[1].residentId).toBe('res-1');
    expect(threads[1].residentName).toBe('Janina Kowalska');
    expect(threads[1].messages).toHaveLength(2);
    expect(threads[1].lastMessage.content).toBe('Tak, zjadła cały posiłek i poszła na krótki spacer.');
  });

  it('filtruje wątki po nazwisku podopiecznego lub treści wiadomości @REQ: NUR-BOARD', () => {
    const threads = groupMessagesIntoThreads(sampleMessages);

    const filteredByName = filterThreadsBySearch(threads, 'Nowak');
    expect(filteredByName).toHaveLength(1);
    expect(filteredByName[0].residentName).toBe('Tadeusz Nowak');

    const filteredByContent = filterThreadsBySearch(threads, 'obiad');
    expect(filteredByContent).toHaveLength(1);
    expect(filteredByContent[0].residentName).toBe('Janina Kowalska');

    const emptyMatch = filterThreadsBySearch(threads, 'nieistniejący');
    expect(emptyMatch).toHaveLength(0);
  });

  it('weryfikuje poprawność danych przed wysłaniem odpowiedzi @REQ: FAM-MESSAGES', () => {
    const validateReply = (residentId?: string, relativeUserId?: string, content?: string) => {
      if (!residentId?.trim()) return { valid: false, error: 'Brak ID podopiecznego' };
      if (!relativeUserId?.trim()) return { valid: false, error: 'Brak ID odbiorcy' };
      if (!content || !content.trim()) return { valid: false, error: 'Treść odpowiedzi nie może być pusta' };
      return { valid: true };
    };

    expect(validateReply('res-1', 'rel-1', 'Wszystko w porządku').valid).toBe(true);
    expect(validateReply('', 'rel-1', 'Treść').valid).toBe(false);
    expect(validateReply('res-1', '', 'Treść').valid).toBe(false);
    expect(validateReply('res-1', 'rel-1', '   ').valid).toBe(false);
  });
});
