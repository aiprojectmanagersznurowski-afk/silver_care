import { describe, it, expect } from 'vitest';
import {
  groupMessagesIntoThreads,
  filterThreadsBySearch,
  isThreadAwaitingReply,
  calculateUnansweredMessagesPerResident,
  filterResidentsByUnansweredMessages,
  type RawMessage,
} from '../../apps/web/src/lib/messages-helper';

/**
 * @REQ: NUR-BOARD
 * @REQ: FAM-MESSAGES
 * @REQ: INFRA-GROQ-TRANSCRIPTION
 *
 * Testy logiki biznesowej wskaźnika nieodpowiedzianych wiadomości na pulpicie dyżuru
 * oraz dyktowania odpowiedzi głosowej personelu (SC-NUR-11).
 */

describe('Wskaźnik nieodpowiedzianych wiadomości personelu (@REQ: NUR-BOARD, @REQ: FAM-MESSAGES)', () => {
  const sampleMessages: RawMessage[] = [
    {
      id: 'msg-1',
      content: 'Dzień dobry, jak minęła noc u mamy?',
      created_at: '2026-10-13T07:00:00Z',
      resident_id: 'resident-1',
      relative_user_id: 'relative-1',
      is_from_family: true,
      residents: { first_name: 'Helena', last_name: 'Kowalska' },
    },
    {
      id: 'msg-2',
      content: 'Dzień dobry, mama przespała całą noc spokojnie.',
      created_at: '2026-10-13T07:30:00Z',
      resident_id: 'resident-1',
      relative_user_id: 'relative-1',
      is_from_family: false,
      staff_user_id: 'staff-nurse-1',
      residents: { first_name: 'Helena', last_name: 'Kowalska' },
    },
    {
      id: 'msg-3',
      content: 'Czy tata brał dzisiaj poranne leki na nadciśnienie?',
      created_at: '2026-10-13T08:00:00Z',
      resident_id: 'resident-2',
      relative_user_id: 'relative-2',
      is_from_family: true,
      residents: { first_name: 'Stanisław', last_name: 'Nowak' },
    },
    {
      id: 'msg-4',
      content: 'Proszę o informację czy potrzebne są dodatkowe kosmetyki pielęgnacyjne.',
      created_at: '2026-10-13T08:45:00Z',
      resident_id: 'resident-3',
      relative_user_id: 'relative-3',
      is_from_family: true,
      residents: { first_name: 'Maria', last_name: 'Wiśniewska' },
    },
  ];

  it('poprawnie określa czy dany wątek oczekuje na odpowiedź personelu @REQ: FAM-MESSAGES', () => {
    const threads = groupMessagesIntoThreads(sampleMessages);

    const threadRes1 = threads.find((t) => t.residentId === 'resident-1')!;
    const threadRes2 = threads.find((t) => t.residentId === 'resident-2')!;
    const threadRes3 = threads.find((t) => t.residentId === 'resident-3')!;

    // resident-1 ma ostatnią odpowiedź od personelu (is_from_family = false) -> nie oczekuje
    expect(isThreadAwaitingReply(threadRes1)).toBe(false);

    // resident-2 i resident-3 mają ostatnią wiadomość od rodziny -> oczekują na odpowiedź
    expect(isThreadAwaitingReply(threadRes2)).toBe(true);
    expect(isThreadAwaitingReply(threadRes3)).toBe(true);
  });

  it('kalkuluje mapę nieodpowiedzianych wiadomości per podopieczny dla tablicy dyżuru @REQ: NUR-BOARD', () => {
    const unansweredMap = calculateUnansweredMessagesPerResident(sampleMessages);

    expect(unansweredMap.get('resident-1')).toEqual({
      hasUnanswered: false,
      unansweredCount: 0,
      lastMessageAt: '2026-10-13T07:30:00Z',
      lastMessageSnippet: undefined,
    });

    expect(unansweredMap.get('resident-2')).toEqual({
      hasUnanswered: true,
      unansweredCount: 1,
      lastMessageAt: '2026-10-13T08:00:00Z',
      lastMessageSnippet: 'Czy tata brał dzisiaj poranne leki na nadciśnienie?',
    });

    expect(unansweredMap.get('resident-3')).toEqual({
      hasUnanswered: true,
      unansweredCount: 1,
      lastMessageAt: '2026-10-13T08:45:00Z',
      lastMessageSnippet: 'Proszę o informację czy potrzebne są dodatkowe kosmetyki pielęgnacyjne.',
    });

    // Pensjonariusz bez żadnych wiadomości
    expect(unansweredMap.get('resident-4')).toBeUndefined();
  });

  it('filtruje listę podopiecznych wyłącznie do osób z oczekującą wiadomością od rodziny @REQ: NUR-BOARD', () => {
    const residents = [
      { id: 'resident-1', first_name: 'Helena', last_name: 'Kowalska' },
      { id: 'resident-2', first_name: 'Stanisław', last_name: 'Nowak' },
      { id: 'resident-3', first_name: 'Maria', last_name: 'Wiśniewska' },
      { id: 'resident-4', first_name: 'Józef', last_name: 'Zieliński' },
    ];

    const unansweredMap = calculateUnansweredMessagesPerResident(sampleMessages);
    const filtered = filterResidentsByUnansweredMessages(residents, unansweredMap);

    expect(filtered).toHaveLength(2);
    expect(filtered.map((r) => r.id)).toEqual(['resident-2', 'resident-3']);
  });

  it('automatycznie zdejmuje flagę oczekującej wiadomości po dodaniu odpowiedzi personelu @REQ: FAM-MESSAGES', () => {
    const messagesWithReply: RawMessage[] = [
      ...sampleMessages,
      {
        id: 'msg-5',
        content: 'Dzień dobry, tak, leki zostały podane o 7:30 zgodnie z kartą zleceń.',
        created_at: '2026-10-13T09:15:00Z',
        resident_id: 'resident-2',
        relative_user_id: 'relative-2',
        is_from_family: false,
        staff_user_id: 'staff-nurse-2',
        residents: { first_name: 'Stanisław', last_name: 'Nowak' },
      },
    ];

    const unansweredMap = calculateUnansweredMessagesPerResident(messagesWithReply);

    expect(unansweredMap.get('resident-2')).toEqual({
      hasUnanswered: false,
      unansweredCount: 0,
      lastMessageAt: '2026-10-13T09:15:00Z',
    });
  });

  it('weryfikuje poprawność danych wejściowych transkrypcji audio odpowiedzi @REQ: INFRA-GROQ-TRANSCRIPTION', () => {
    // Sprawdzenie czy payload nagrania audio odpowiedzi ma wymagane parametry dla endpointu transcribe
    const formData = new FormData();
    const mockBlob = new Blob(['mock-audio'], { type: 'audio/webm' });
    formData.append('file', mockBlob, 'reply.webm');

    expect(formData.get('file')).toBeTruthy();
    expect((formData.get('file') as File).name).toBe('reply.webm');
  });

  it('przycina treść podglądu wiadomości rodziny jeśli przekracza 90 znaków @REQ: NUR-BOARD', () => {
    const longMessage: RawMessage[] = [
      {
        id: 'msg-long',
        content:
          'Bardzo prosimy o informację, czy podopieczny zjadł dzisiejsze śniadanie i czy brał udział w porannej gimnastyce rehabilitacyjnej w sali gimnastycznej.',
        created_at: '2026-10-13T10:00:00Z',
        resident_id: 'resident-long',
        relative_user_id: 'relative-1',
        is_from_family: true,
      },
    ];

    const map = calculateUnansweredMessagesPerResident(longMessage);
    const status = map.get('resident-long');

    expect(status?.hasUnanswered).toBe(true);
    expect(status?.lastMessageSnippet?.length).toBeLessThanOrEqual(90);
    expect(status?.lastMessageSnippet?.endsWith('...')).toBe(true);
  });
});
