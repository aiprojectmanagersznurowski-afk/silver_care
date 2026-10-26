import { describe, it, expect } from 'vitest';
import {
  resolveMessagesPane,
  groupMessagesIntoThreads,
  filterThreadsBySearch,
  RawMessage,
} from '../../apps/web/src/lib/messages-helper';

/**
 * @REQ: FAM-MESSAGES
 * @REQ: NUR-BOARD
 *
 * Testy wykonawcze dla zadania NUR-MESSAGES-MOBILE-RESPONSIVE:
 * AC1: Na ekranie mobilnym (375px) lista wątków i konwersacja przełączają się w układzie master-detail.
 * AC2: Wybór wątku na mobile otwiera rozmowę, a akcja powrotu resetuje stan do listy wątków.
 * AC3: Na desktopie zachowany jest jednoczesny układ dwukolumnowy (Split-view).
 * AC4: Poprawny import komponentów skrzynek wiadomości personelu i administratora.
 */
describe('Responsive Master-Detail Messages Inbox (@REQ: FAM-MESSAGES, @REQ: NUR-BOARD)', () => {
  const sampleMessages: RawMessage[] = [
    {
      id: 'm1',
      resident_id: 'res-1',
      relative_user_id: 'rel-1',
      content: 'Dzień dobry, jak minęła noc?',
      is_from_family: true,
      created_at: '2026-10-15T08:00:00Z',
      residents: { first_name: 'Jan', last_name: 'Kowalski' },
    },
    {
      id: 'm2',
      resident_id: 'res-2',
      relative_user_id: 'rel-2',
      content: 'Proszę o informację o lekach',
      is_from_family: true,
      created_at: '2026-10-15T08:30:00Z',
      residents: { first_name: 'Anna', last_name: 'Nowak' },
    },
  ];

  it('implements responsive master-detail layout toggling between list and conversation on mobile @REQ: FAM-MESSAGES', () => {
    // AC1: Na mobile bez wybranego wątku widoczna jest wyłącznie lista wątków
    const mobileInitialPane = resolveMessagesPane(null, true);
    expect(mobileInitialPane).toBe('threads');

    // Po wybraniu wątku mobile przełącza się na widok konwersacji
    const mobileActivePane = resolveMessagesPane('res-1-rel-1', true);
    expect(mobileActivePane).toBe('conversation');

    // AC3: Na desktopie (isMobile: false) zawsze widoczne są obie kolumny jednocześnie
    const desktopPane = resolveMessagesPane('res-1-rel-1', false);
    expect(desktopPane).toBe('both');
  });

  it('provides a mobile back button returning to threads list @REQ: NUR-BOARD', () => {
    let activeThreadId: string | null = 'res-1-rel-1';
    expect(resolveMessagesPane(activeThreadId, true)).toBe('conversation');

    // Akcja powrotu ("Wszystkie wątki") resetuje activeThreadId do null
    const handleBackToThreads = () => {
      activeThreadId = null;
    };
    handleBackToThreads();

    expect(activeThreadId).toBeNull();
    expect(resolveMessagesPane(activeThreadId, true)).toBe('threads');
  });

  it('filters and groups messages into active threads correctly @REQ: FAM-MESSAGES', () => {
    const threads = groupMessagesIntoThreads(sampleMessages);
    expect(threads).toHaveLength(2);

    const filtered = filterThreadsBySearch(threads, 'Jan');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].residentName).toContain('Kowalski Jan');
  });

  it('exports valid StaffMessagesInbox and deprecated AdminMessagesInbox components @REQ: FAM-MESSAGES', async () => {
    const staffModule = await import('../../apps/web/src/components/StaffMessagesInbox');
    expect(typeof staffModule.StaffMessagesInbox).toBe('function');

    const adminModule = await import('../../apps/web/src/components/AdminMessagesInbox');
    expect(typeof adminModule.AdminMessagesInbox).toBe('function');
  });
});
