import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * @REQ: FAM-MESSAGES
 * @REQ: NUR-BOARD
 *
 * Testy dla zadania NUR-MESSAGES-MOBILE-RESPONSIVE:
 * AC1: Na ekranie o szerokości 375px lista wątków wypełnia 100% szerokości (w-full).
 * AC2: Wybór wątku na mobile płynnie otwiera okno konwersacji z przyciskiem powrotu ("Wszystkie wątki").
 * AC3: Na desktopie zachowany jest dotychczasowy układ dwukolumnowy (Split-view).
 * AC4: Wycofany komponent AdminMessagesInbox.tsx posiada oznaczenie @deprecated.
 */
describe('Responsive Master-Detail Messages Inbox (@REQ: FAM-MESSAGES, @REQ: NUR-BOARD)', () => {
  const staffMessagesPath = path.resolve(process.cwd(), 'apps/web/src/components/StaffMessagesInbox.tsx');
  const adminMessagesPath = path.resolve(process.cwd(), 'apps/web/src/components/AdminMessagesInbox.tsx');

  it('implements responsive master-detail layout toggling between list and conversation on mobile @REQ: FAM-MESSAGES', () => {
    const content = fs.readFileSync(staffMessagesPath, 'utf8');

    // Kolumna listy wątków przełącza się na pełną szerokość w-full i ukrywa na mobile gdy aktywny jest wątek
    expect(content).toMatch(/w-full\s+md:w-(?:80|96)/);
    expect(content).toContain('hidden md:flex');

    // Kolumna rozmowy wypełnia całą szerokość na mobile i zachowuje md:flex-1 na desktopie
    expect(content).toMatch(/(?:flex\s+w-full|w-full\s+flex)\s+.*md:flex-1/);
  });

  it('provides a mobile back button returning to threads list @REQ: NUR-BOARD', () => {
    const content = fs.readFileSync(staffMessagesPath, 'utf8');

    // Przycisk powrotu do listy wątków widoczny na mobile (ukryty na md)
    expect(content).toContain('Wszystkie wątki');
    expect(content).toMatch(/setActiveThreadId\(\s*null\s*\)/);
    expect(content).toContain('md:hidden');
  });

  it('marks deprecated duplicate AdminMessagesInbox with @deprecated docstring @REQ: FAM-MESSAGES', () => {
    const content = fs.readFileSync(adminMessagesPath, 'utf8');

    expect(content).toContain('@deprecated');
    expect(content).toContain('StaffMessagesInbox');
  });
});
