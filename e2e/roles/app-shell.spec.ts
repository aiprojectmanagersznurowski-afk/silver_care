import { test, expect } from '../fixtures/base-test';
import { AppShellPage } from '../page-objects/AppShellPage';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * Powłoka z szablonu shadcn-admin (ADR-014): zwijany pasek boczny w panelu
 * administratora i personelu, stan zwinięcia zapamiętany po przeładowaniu.
 */

const SHELLS = [
  { role: 'org_admin' as const, start: '/admin', link: '/admin/residents' },
  { role: 'nurse' as const, start: '/staff', link: '/staff/agenda' },
];

test.describe('Powłoka aplikacji — zwijany pasek boczny (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  for (const shell of SHELLS) {
    test(`@REQ: UI-TEMPLATE-ALIGNMENT - ${shell.role}: pasek boczny zwija się do ikon i pamięta stan`, async ({ loginPage, page }) => {
      await loginPage.loginAs(shell.role);
      await page.goto(shell.start);

      const appShell = new AppShellPage(page);
      await expect(appShell.inset).toBeVisible();
      await appShell.expectExpanded();
      await expect(appShell.navLink(shell.link)).toBeVisible();

      await appShell.toggle();
      await appShell.expectCollapsed();
      // W trybie ikon nawigacja nadal działa
      await expect(appShell.navLink(shell.link)).toBeVisible();

      await page.reload();
      await appShell.expectCollapsed();

      await appShell.toggle();
      await appShell.expectExpanded();
    });
  }
});
