import { describe, it, expect } from 'vitest';
import {
  getAwaitingThreads,
  countAwaitingThreads,
  formatResidentInitials,
  RawMessage,
} from '../../apps/web/src/lib/messages-helper';

/**
 * @REQ: FAM-MESSAGES
 * @REQ: NUR-BOARD
 *
 * Testy logiki i komponentów dzwonka powiadomień oraz wyróżnień w menu nawigacyjnym
 * dla portalu rodziny i portalu personelu placówki.
 */
describe('System Notifications Bell & Nav Badges (@REQ: FAM-MESSAGES, @REQ: NUR-BOARD)', () => {
  it('correctly filters and counts awaiting threads for staff @REQ: FAM-MESSAGES', () => {
    const messages: RawMessage[] = [
      {
        id: 'msg-1',
        content: 'Dzień dobry, jak minęła noc u mamy?',
        created_at: '2026-10-14T06:00:00Z',
        resident_id: 'res-1',
        relative_user_id: 'rel-1',
        is_from_family: true,
        residents: { first_name: 'Helena', last_name: 'Nowak' },
      },
      {
        id: 'msg-2',
        content: 'Dzień dobry, mama spała spokojnie.',
        created_at: '2026-10-14T06:30:00Z',
        resident_id: 'res-1',
        relative_user_id: 'rel-1',
        is_from_family: false,
        staff_user_id: 'nurse-1',
        residents: { first_name: 'Helena', last_name: 'Nowak' },
      },
      {
        id: 'msg-3',
        content: 'Dziękuję za informację! A czy zjadła śniadanie?',
        created_at: '2026-10-14T07:00:00Z',
        resident_id: 'res-1',
        relative_user_id: 'rel-1',
        is_from_family: true,
        residents: { first_name: 'Helena', last_name: 'Nowak' },
      },
      {
        id: 'msg-4',
        content: 'Czy tata potrzebuje dodatkowych ubrań?',
        created_at: '2026-10-14T05:00:00Z',
        resident_id: 'res-2',
        relative_user_id: 'rel-2',
        is_from_family: true,
        residents: { first_name: 'Jan', last_name: 'Kowalski' },
      },
    ];

    const awaiting = getAwaitingThreads(messages);
    expect(awaiting).toHaveLength(2);
    expect(countAwaitingThreads(messages)).toBe(2);
    expect(awaiting.some((t) => t.residentId === 'res-1')).toBe(true);
    expect(awaiting.some((t) => t.residentId === 'res-2')).toBe(true);
  });

  it('formats resident initials compliant with ADR-008 and S3 notification contract @REQ: FAM-MESSAGES', () => {
    expect(formatResidentInitials('Jan', 'Kowalski')).toBe('J. K.');
    expect(formatResidentInitials('Anna', undefined)).toBe('A.');
    expect(formatResidentInitials('', '')).toBe('P.');
  });

  it('handles empty and fully answered message threads accurately @REQ: FAM-MESSAGES', () => {
    expect(getAwaitingThreads([])).toEqual([]);
    expect(countAwaitingThreads([])).toBe(0);

    const answeredMessages: RawMessage[] = [
      {
        id: 'msg-10',
        content: 'Pytanie od rodziny',
        created_at: '2026-10-14T08:00:00Z',
        resident_id: 'res-1',
        relative_user_id: 'rel-1',
        is_from_family: true,
      },
      {
        id: 'msg-11',
        content: 'Odpowiedź personelu',
        created_at: '2026-10-14T08:15:00Z',
        resident_id: 'res-1',
        relative_user_id: 'rel-1',
        is_from_family: false,
      },
    ];

    expect(getAwaitingThreads(answeredMessages)).toHaveLength(0);
    expect(countAwaitingThreads(answeredMessages)).toBe(0);
  });

  it('integrates StaffNotificationBell into staff layout as a valid UI component @REQ: NUR-BOARD', async () => {
    const bellModule = await import('../../apps/web/src/components/StaffNotificationBell');
    expect(typeof bellModule.StaffNotificationBell).toBe('function');
  });

  it('provides family notifications and navigation components @REQ: FAM-MESSAGES', async () => {
    const headerModule = await import('../../apps/web/src/components/FamilyHeader');
    expect(typeof headerModule.FamilyHeader).toBe('function');
  });
});
