import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  getAwaitingThreads,
  countAwaitingThreads,
  formatResidentInitials,
  RawMessage,
} from '@/lib/messages-helper';

/**
 * @REQ: FAM-MESSAGES
 * @REQ: NUR-BOARD
 *
 * Testy logiki i komponentów dzwonka powiadomień oraz wyróżnień w menu nawigacyjnym
 * dla portalu rodziny i portalu personelu placówki.
 */
describe('System Notifications Bell & Nav Badges (@REQ: FAM-MESSAGES, @REQ: NUR-BOARD)', () => {
  const staffNotificationBellPath = path.resolve(
    process.cwd(),
    'apps/web/src/components/StaffNotificationBell.tsx'
  );
  const staffSidebarPath = path.resolve(
    process.cwd(),
    'apps/web/src/components/StaffSidebar.tsx'
  );
  const staffLayoutPath = path.resolve(
    process.cwd(),
    'apps/web/src/app/(staff)/layout.tsx'
  );
  const familyHeaderPath = path.resolve(
    process.cwd(),
    'apps/web/src/components/FamilyHeader.tsx'
  );

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

  it('integrates StaffNotificationBell into staff layout and provides bell dropdown with badges @REQ: NUR-BOARD', () => {
    const layoutContent = fs.readFileSync(staffLayoutPath, 'utf8');
    expect(layoutContent).toContain('StaffNotificationBell');

    const bellContent = fs.readFileSync(staffNotificationBellPath, 'utf8');
    expect(bellContent).toContain('staff-notifications-bell');
    expect(bellContent).toContain('staff-notifications-badge');
    expect(bellContent).toContain('staff-notifications-dropdown');
    expect(bellContent).toContain('/staff/messages');
  });

  it('integrates badges for unanswered messages in StaffSidebar and SidebarNav @REQ: NUR-BOARD', () => {
    const sidebarContent = fs.readFileSync(staffSidebarPath, 'utf8');
    expect(sidebarContent).toContain('useStaffUnansweredMessages');
    expect(sidebarContent).toContain('badge: unansweredCount > 0 ? unansweredCount : undefined');
  });

  it('provides family notifications bell and highlights Messages tab in FamilyHeader @REQ: FAM-MESSAGES', () => {
    const headerContent = fs.readFileSync(familyHeaderPath, 'utf8');
    expect(headerContent).toContain('family-notifications-bell');
    expect(headerContent).toContain('family-notifications-badge');
    expect(headerContent).toContain('family-nav-messages-badge');
    expect(headerContent).toContain('family-mobile-messages-badge');
    expect(headerContent).toContain('/messages');
  });
});
