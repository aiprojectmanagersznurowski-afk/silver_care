/**
 * @REQ: FAM-MESSAGES
 *
 * Wątki w skrzynce kierownika (decyzje Michała 2026-10-26): kto z bliskich pisze, filtr „Do odpowiedzi”,
 * dociąganie tylko nowych wiadomości i stały wybór wątku przy odświeżaniu.
 */
import { roleLabel } from '@/lib/auth/role-labels'
import { isThreadAwaitingReply, type MessageThread, type RawMessage } from '@/lib/messages-helper'

export interface RelativeInfo {
  role: string
  isPrimaryContact: boolean
}

export function relativeKey(residentId: string, relativeUserId: string): string {
  return `${residentId}:${relativeUserId}`
}

/** Rola bliskiego z kontraktu; bez powiązania — jawny brak danych, nie zgadywanie. */
export function relativeLabel(info: RelativeInfo | undefined): string {
  if (!info) return 'Brak danych o roli bliskiego'
  return info.isPrimaryContact ? `${roleLabel(info.role)} · główny kontakt` : roleLabel(info.role)
}

export function countAwaitingReply(threads: MessageThread[]): number {
  return threads.filter(isThreadAwaitingReply).length
}

export function filterAwaitingReply(threads: MessageThread[], onlyAwaiting: boolean): MessageThread[] {
  return onlyAwaiting ? threads.filter(isThreadAwaitingReply) : threads
}

/** Łączy pobrane wiadomości bez duplikatów; najnowsze pierwsze (jak odpowiedź API). */
export function mergeMessages(existing: RawMessage[], incoming: RawMessage[]): RawMessage[] {
  const byId = new Map<string, RawMessage>()
  for (const m of [...existing, ...incoming]) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function latestCreatedAt(messages: RawMessage[]): string | null {
  return messages.reduce<string | null>((max, m) => (!max || m.created_at > max ? m.created_at : max), null)
}

/**
 * Wątek do pokazania po odświeżeniu: dotychczasowy, jeśli nadal istnieje; inaczej wskazany podopieczny
 * albo (na szerokim ekranie) pierwszy wątek.
 */
export function keepSelectedThread(
  current: string | null,
  threads: MessageThread[],
  options: { preferResidentId?: string; autoSelectFirst: boolean }
): string | null {
  if (current && threads.some((t) => t.threadId === current)) return current
  if (options.preferResidentId) {
    const match = threads.find((t) => t.residentId === options.preferResidentId)
    if (match) return match.threadId
  }
  return options.autoSelectFirst ? threads[0]?.threadId ?? null : null
}

/** Enter wysyła tylko przy klawiaturze fizycznej; na ekranie dotykowym Enter to nowa linia. */
export function shouldSendOnEnter(event: { key: string; shiftKey: boolean }, isCoarsePointer: boolean): boolean {
  return event.key === 'Enter' && !event.shiftKey && !isCoarsePointer
}
