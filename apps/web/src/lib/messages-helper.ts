/**
 * @REQ: FAM-MESSAGES
 * @REQ: NUR-BOARD
 *
 * Pomocnicze funkcje przetwarzania i grupowania wiadomości od rodzin w wątki.
 */

export interface RawMessage {
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

export interface MessageThread {
  threadId: string;
  residentId: string;
  relativeUserId: string;
  residentName: string;
  lastMessage: RawMessage;
  unreadCount: number;
  messages: RawMessage[];
}

export function groupMessagesIntoThreads(messages: RawMessage[]): MessageThread[] {
  const threadsMap = new Map<string, MessageThread>();

  // Sort chronologically ascending so conversation is natural
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

export function filterThreadsBySearch(threads: MessageThread[], query: string): MessageThread[] {
  if (!query || !query.trim()) return threads;
  const q = query.toLowerCase().trim();
  return threads.filter(
    (t) =>
      t.residentName.toLowerCase().includes(q) ||
      t.messages.some((m) => m.content.toLowerCase().includes(q))
  );
}
