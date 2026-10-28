import { describe, it, expect } from 'vitest'
import {
  relativeKey,
  relativeLabel,
  countAwaitingReply,
  filterAwaitingReply,
  mergeMessages,
  latestCreatedAt,
  shouldSendOnEnter,
  keepSelectedThread,
  threadsEmptyState,
} from '../../apps/web/src/lib/message-threads'
import { groupMessagesIntoThreads, type RawMessage } from '../../apps/web/src/lib/messages-helper'

/**
 * @REQ: FAM-MESSAGES
 *
 * Skrzynka kierownika (decyzje Michała 2026-10-26): widać, kto z bliskich pisze; filtr „Do odpowiedzi”;
 * odświeżanie dociąga tylko nowe wiadomości i nie zmienia wybranego wątku; Enter na telefonie nie wysyła.
 */
const msg = (id: string, at: string, fromFamily: boolean, resident = 'r1', relative = 'u1'): RawMessage => ({
  id, content: `treść ${id}`, created_at: at, resident_id: resident, relative_user_id: relative, is_from_family: fromFamily,
  residents: { first_name: 'Jan', last_name: 'Kowalski' },
})

describe('Wątki wiadomości kierownika (@REQ: FAM-MESSAGES)', () => {
  it('@REQ: FAM-MESSAGES - opis bliskiego z roli w kontrakcie, bez wymyślania danych', () => {
    expect(relativeKey('r1', 'u1')).toBe('r1:u1')
    expect(relativeLabel({ role: 'legal_guardian', isPrimaryContact: true })).toBe('Opiekun prawny · główny kontakt')
    expect(relativeLabel({ role: 'family', isPrimaryContact: false })).toBe('Członek rodziny')
    expect(relativeLabel(undefined)).toBe('Brak danych o roli bliskiego')
  })

  it('@REQ: FAM-MESSAGES - licznik i filtr wątków czekających na odpowiedź', () => {
    const threads = groupMessagesIntoThreads([
      msg('1', '2026-10-26T08:00:00Z', true, 'r1', 'u1'),
      msg('2', '2026-10-26T09:00:00Z', false, 'r2', 'u2'),
      msg('3', '2026-10-26T10:00:00Z', true, 'r3', 'u3'),
    ])
    expect(countAwaitingReply(threads)).toBe(2)
    expect(filterAwaitingReply(threads, true).map((t) => t.residentId).sort()).toEqual(['r1', 'r3'])
    expect(filterAwaitingReply(threads, false)).toHaveLength(3)
  })

  it('@REQ: FAM-MESSAGES - dociąganie nowych wiadomości bez duplikatów, najnowsze pierwsze', () => {
    const existing = [msg('2', '2026-10-26T09:00:00Z', true), msg('1', '2026-10-26T08:00:00Z', true)]
    const merged = mergeMessages(existing, [msg('3', '2026-10-26T10:00:00Z', false), msg('2', '2026-10-26T09:00:00Z', true)])
    expect(merged.map((m) => m.id)).toEqual(['3', '2', '1'])
    expect(latestCreatedAt(merged)).toBe('2026-10-26T10:00:00Z')
    expect(latestCreatedAt([])).toBeNull()
  })

  it('@REQ: FAM-MESSAGES - wybrany wątek zostaje po odświeżeniu, jeśli nadal istnieje', () => {
    const threads = groupMessagesIntoThreads([msg('1', '2026-10-26T08:00:00Z', true, 'r1'), msg('2', '2026-10-26T09:00:00Z', true, 'r2')])
    const second = threads.find((t) => t.residentId === 'r1')!.threadId
    expect(keepSelectedThread(second, threads, { preferResidentId: undefined, autoSelectFirst: true })).toBe(second)
    expect(keepSelectedThread(null, threads, { preferResidentId: 'r1', autoSelectFirst: true })).toBe(second)
    expect(keepSelectedThread(null, threads, { preferResidentId: undefined, autoSelectFirst: true })).toBe(threads[0].threadId)
    expect(keepSelectedThread(null, threads, { preferResidentId: undefined, autoSelectFirst: false })).toBeNull()
    expect(keepSelectedThread('zniknął', threads, { preferResidentId: undefined, autoSelectFirst: false })).toBeNull()
  })

  it('@REQ: FAM-MESSAGES - Enter wysyła tylko przy klawiaturze fizycznej, Shift+Enter nigdy', () => {
    expect(shouldSendOnEnter({ key: 'Enter', shiftKey: false }, false)).toBe(true)
    expect(shouldSendOnEnter({ key: 'Enter', shiftKey: true }, false)).toBe(false)
    expect(shouldSendOnEnter({ key: 'Enter', shiftKey: false }, true)).toBe(false)
    expect(shouldSendOnEnter({ key: 'a', shiftKey: false }, false)).toBe(false)
  })

  it('@REQ: FAM-MESSAGES - dedykowany stan pusty listy wątków wg UI-FOUR-STATES (AC4)', () => {
    expect(threadsEmptyState({ searchQuery: '', onlyAwaiting: true, totalThreadCount: 3 })).toEqual({
      title: 'Wszystkie wiadomości od rodzin zostały obsłużone',
      description: 'Brak wątków oczekujących na odpowiedź personelu.',
    })
    expect(threadsEmptyState({ searchQuery: '', onlyAwaiting: true, totalThreadCount: 0 })).toEqual({
      title: 'Brak wiadomości',
      description: 'Nie ma jeszcze wiadomości od rodzin.',
    })
    expect(threadsEmptyState({ searchQuery: 'Kowalski', onlyAwaiting: false, totalThreadCount: 3 })).toEqual({
      title: 'Brak wyników wyszukiwania',
      description: 'Brak wyników pasujących do wpisanej frazy.',
    })
    expect(threadsEmptyState({ searchQuery: '', onlyAwaiting: false, totalThreadCount: 0 })).toEqual({
      title: 'Brak wiadomości',
      description: 'Nie ma jeszcze wiadomości od rodzin.',
    })
  })
})
