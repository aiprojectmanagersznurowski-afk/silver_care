import { test, expect } from '../fixtures/base-test';
import { ViewTogglePage } from '../page-objects/ViewTogglePage';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * Każdy widok listy obiektów ma przełącznik kafelki/tabela; bez zapamiętanej preferencji
 * otwiera się tabela. Wyjątek: rejestry audytowe (wyłącznie tabela) — tu ich nie ma.
 */
const SCREENS: { role: 'org_admin' | 'super_admin' | 'nurse'; paths: string[] }[] = [
  { role: 'org_admin', paths: ['/admin/residents', '/admin/staff', '/admin/invitations', '/admin/facility', '/admin/reports/daily'] },
  { role: 'super_admin', paths: ['/admin/organizations', '/admin/iam'] },
  { role: 'nurse', paths: ['/staff', '/voice'] },
];

test.describe('Przełącznik kafelki/tabela, domyślnie tabela (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  for (const { role, paths } of SCREENS) {
    test(`@REQ: UI-TEMPLATE-ALIGNMENT - ${role}: ${paths.length} widoków z przełącznikiem i domyślną tabelą`, async ({ loginPage, page }) => {
      await loginPage.loginAs(role);
      const views = new ViewTogglePage(page);
      const problems: Record<string, string> = {};

      for (const path of paths) {
        await views.gotoFresh(path);
        if (!(await views.toggle.isVisible())) { problems[path] = 'brak przełącznika'; continue; }
        const pressed = await views.pressedLabel();
        if (pressed !== 'Widok tabeli') { problems[path] = `domyślnie: ${pressed}`; continue; }
        await views.gridButton.click();
        if ((await views.pressedLabel()) !== 'Widok kafelków') problems[path] = 'kafelki nie włączają się';
        await views.tableButton.click();
      }
      expect(problems).toEqual({});
    });
  }

  test('@REQ: UI-TEMPLATE-ALIGNMENT - rejestry audytowe nie mają przełącznika', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const views = new ViewTogglePage(page);
    await views.gotoFresh('/admin/audit');
    await expect(page.locator('[data-slot="view-toggle"]')).toHaveCount(0);
  });
});
