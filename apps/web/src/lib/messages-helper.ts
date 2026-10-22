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
      } else {
        thread.unreadCount = 0;
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

/**
 * Sprawdza czy dany wątek oczekuje na odpowiedź personelu
 * (ostatnia wiadomość w wątku pochodzi od rodziny).
 */
export function isThreadAwaitingReply(thread: MessageThread): boolean {
  if (!thread || !thread.lastMessage) return false;
  return Boolean(thread.lastMessage.is_from_family);
}

export interface ResidentUnansweredStatus {
  hasUnanswered: boolean;
  unansweredCount: number;
  lastMessageAt: string;
  lastMessageSnippet?: string;
}

/**
 * Wylicza mapę statusu oczekujących wiadomości od rodzin per pensjonariusz.
 */
export function calculateUnansweredMessagesPerResident(
  messages: RawMessage[]
): Map<string, ResidentUnansweredStatus> {
  const result = new Map<string, ResidentUnansweredStatus>();
  if (!messages || messages.length === 0) return result;

  const threads = groupMessagesIntoThreads(messages);

  const residentThreadsMap = new Map<string, MessageThread[]>();
  for (const thread of threads) {
    const list = residentThreadsMap.get(thread.residentId) || [];
    list.push(thread);
    residentThreadsMap.set(thread.residentId, list);
  }

  for (const [residentId, rThreads] of residentThreadsMap.entries()) {
    rThreads.sort(
      (a, b) =>
        new Date(b.lastMessage.created_at).getTime() -
        new Date(a.lastMessage.created_at).getTime()
    );

    const latestThread = rThreads[0];
    const awaitingThreads = rThreads.filter(isThreadAwaitingReply);
    const hasUnanswered = awaitingThreads.length > 0;
    const unansweredCount = awaitingThreads.reduce(
      (acc, t) => acc + (t.unreadCount || 1),
      0
    );

    let lastMessageSnippet: string | undefined = undefined;
    if (hasUnanswered) {
      const awaitingThread = awaitingThreads[0];
      const familyMsgs = awaitingThread.messages.filter((m) => m.is_from_family);
      const lastFamilyMsg = familyMsgs[familyMsgs.length - 1];
      const rawText = lastFamilyMsg?.content || awaitingThread.lastMessage?.content || '';
      lastMessageSnippet = rawText.length > 90 ? rawText.slice(0, 87) + '...' : rawText;
    }

    result.set(residentId, {
      hasUnanswered,
      unansweredCount: hasUnanswered ? unansweredCount : 0,
      lastMessageAt: latestThread.lastMessage.created_at,
      lastMessageSnippet,
    });
  }

  return result;
}


/**
 * Filtruje listę podopiecznych wyłącznie do osób z oczekującą wiadomością.
 */
export function filterResidentsByUnansweredMessages<T extends { id?: unknown }>(
  residents: T[],
  unansweredMap: Map<string, { hasUnanswered: boolean }>
): T[] {
  return residents.filter((r) => {
    const resId = String(r.id || '');
    const status = unansweredMap.get(resId);
    return Boolean(status?.hasUnanswered);
  });
}

/**
 * Zwraca listę wątków oczekujących na odpowiedź personelu.
 */
export function getAwaitingThreads(messages: RawMessage[]): MessageThread[] {
  if (!messages || messages.length === 0) return [];
  const threads = groupMessagesIntoThreads(messages);
  return threads.filter(isThreadAwaitingReply);
}

/**
 * Zlicza łączną liczbę wątków oczekujących na odpowiedź personelu.
 */
export function countAwaitingThreads(messages: RawMessage[]): number {
  return getAwaitingThreads(messages).length;
}

/**
 * Zgodnie z S3 notifications.contract.mjs — formatuje inicjały pensjonariusza
 * dla powiadomień in-app bez ujawniania pełnego nazwiska.
 */
export function formatResidentInitials(firstName?: string, lastName?: string): string {
  const f = firstName?.trim() ? firstName.trim()[0].toUpperCase() + '.' : '';
  const l = lastName?.trim() ? lastName.trim()[0].toUpperCase() + '.' : '';
  if (f && l) return `${f} ${l}`;
  if (f || l) return `${f || l}`;
  return 'P.';
}

/**
 * Wyznacza aktywny widok dla responsywnego układu wiadomości personelu (NUR-MESSAGES-MOBILE-RESPONSIVE).
 */
export function resolveMessagesPane(
  activeThreadId: string | null,
  isMobile: boolean
): 'threads' | 'conversation' | 'both' {
  if (!isMobile) return 'both';
  return activeThreadId ? 'conversation' : 'threads';
}

