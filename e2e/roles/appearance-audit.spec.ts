import { test, expect } from '../fixtures/base-test';
import { AppearancePage } from '../page-objects/AppearancePage';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: MDR-NO-INTERPRETATION
 *
 * PR 4/4 (ADR-011, ADR-014): w całej aplikacji jeden akcent (zieleń marki), brak gradientów
 * i brak kolorów niosących ocenę. Audyt na obliczonych stylach, osobno dla każdej roli.
 */

const AUDIT: { role: 'org_admin' | 'super_admin' | 'nurse' | 'family'; paths: string[] }[] = [
  { role: 'org_admin', paths: ['/admin', '/admin/residents', '/admin/facility', '/admin/staff', '/admin/invitations', '/admin/reports/statistics', '/admin/audit', '/settings/profile'] },
  { role: 'super_admin', paths: ['/admin/organizations', '/admin/iam'] },
  { role: 'nurse', paths: ['/staff', '/staff/agenda', '/staff/messages', '/staff/reports'] },
  { role: 'family', paths: ['/dashboard', '/agenda', '/messages'] },
];

test.describe('Audyt wyglądu — jeden akcent, bez gradientów (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  for (const { role, paths } of AUDIT) {
    test(`@REQ: UI-TEMPLATE-ALIGNMENT - ${role}: ${paths.length} widoków bez kolorów spoza palety marki i bez gradientów`, async ({ loginPage, page }) => {
      await loginPage.loginAs(role);
      const appearance = new AppearancePage(page);
      const problems: Record<string, { offPalette: string[]; gradients: string[] }> = {};

      for (const path of paths) {
        await appearance.goto(path);
        const offPalette = await appearance.offPaletteElements();
        const gradients = await appearance.gradientElements();
        if (offPalette.length || gradients.length) problems[path] = { offPalette, gradients };
      }
      expect(problems).toEqual({});
    });
  }

  test('@REQ: UI-TEMPLATE-ALIGNMENT - logowanie: bez gradientów, przycisk w kolorze akcentu marki', async ({ page }) => {
    const appearance = new AppearancePage(page);
    await appearance.goto('/login');
    expect(await appearance.gradientElements()).toEqual([]);
    expect(await appearance.offPaletteElements()).toEqual([]);
  });
});
