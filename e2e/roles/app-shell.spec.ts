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

test.describe('Powłoka aplikacji — podmenu przy zwiniętym pasku (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  test('@REQ: UI-TEMPLATE-ALIGNMENT - org_admin: zwinięty pasek otwiera podmenu „Analiza” obok ikony, bez rozwijania paska', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin');
    const appShell = new AppShellPage(page);
    await appShell.expectExpanded();
    await appShell.toggle();
    await appShell.expectCollapsed();

    // Standard szablonu (shadcn-admin): pozycja z podmenu przy zwiniętym pasku otwiera menu wysuwane w prawo
    await appShell.sidebar.getByRole('button', { name: 'Analiza' }).click();
    const flyout = page.getByRole('menu');
    await expect(flyout).toBeVisible();
    await expect(flyout.getByRole('menuitem', { name: 'Dane dzienne' })).toBeVisible();
    await flyout.getByRole('menuitem', { name: 'Statystyka' }).click();

    await expect(page).toHaveURL(/\/admin\/reports\/statistics$/);
    await expect(flyout).toBeHidden();
    await appShell.expectCollapsed();

    // Po rozwinięciu paska podmenu wraca do rozwijania w miejscu
    await appShell.toggle();
    await appShell.expectExpanded();
    await expect(appShell.navLink('/admin/reports/daily')).toBeVisible();
  });
});

test.describe('Powłoka aplikacji — wspólny nagłówek szablonu (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  for (const shell of SHELLS) {
    test(`@REQ: UI-TEMPLATE-ALIGNMENT - ${shell.role}: nagłówek 48px, zwijanie i wyszukiwarka po lewej, motyw po prawej`, async ({ loginPage, page }) => {
      await loginPage.loginAs(shell.role);
      await page.goto(shell.start);
      const appShell = new AppShellPage(page);
      await expect(appShell.header).toHaveCount(1);
      expect(await appShell.headerLayout()).toEqual({ height: 48, startHasTrigger: true, startHasSearch: true, endHasTheme: true });
    });
  }
});

test.describe('Powłoka aplikacji — rozwijane menu konta (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  for (const shell of SHELLS) {
    test(`@REQ: UI-TEMPLATE-ALIGNMENT - ${shell.role}: konto w stopce paska bocznego rozwija menu z profilem i wylogowaniem`, async ({ loginPage, page }) => {
      await loginPage.loginAs(shell.role);
      await page.goto(shell.start);
      const appShell = new AppShellPage(page);
      const menu = await appShell.openAccountMenu();
      await expect(appShell.accountTrigger).toContainText('@silvercare.test');
      await expect(menu).toContainText('@silvercare.test');
      await expect(menu.getByRole('menuitem', { name: 'Profil i bezpieczeństwo' })).toBeVisible();
      await expect(menu.getByRole('menuitem', { name: 'Wyloguj się' })).toBeVisible();
    });
  }
});
