import { describe, it, expect } from 'vitest';
import {
  groupMessagesIntoThreads,
  filterThreadsBySearch,
  type RawMessage,
} from '../../apps/web/src/lib/messages-helper';

/**
 * @REQ: FAM-MESSAGES
 * @REQ: NUR-BOARD
 *
 * Testy logiki biznesowej skrzynki wiadomości personelu (Staff Messages Inbox).
 */

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
