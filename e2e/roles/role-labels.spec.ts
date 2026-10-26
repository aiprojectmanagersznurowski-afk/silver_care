import { test, expect } from '../fixtures/base-test';
import { AppShellPage } from '../page-objects/AppShellPage';

/**
 * @REQ: SUP-IAM-PANEL
 *
 * Konto w pasku bocznym pokazuje nazwę roli z kontraktu (ROLES.label), bez identyfikatora technicznego.
 */

const ACCOUNTS = [
  { role: 'super_admin' as const, start: '/admin', label: 'Administrator platformy' },
  { role: 'org_admin' as const, start: '/admin', label: 'Kierownik placówki' },
  { role: 'nurse' as const, start: '/staff', label: 'Personel opiekuńczy' },
];

test.describe('Nazwy ról w pasku bocznym (@REQ: SUP-IAM-PANEL)', () => {
  for (const account of ACCOUNTS) {
    test(`@REQ: SUP-IAM-PANEL - ${account.role}: konto pokazuje „${account.label}”`, async ({ loginPage, page }) => {
      await loginPage.loginAs(account.role);
      await page.goto(account.start);

      const appShell = new AppShellPage(page);
      await expect(appShell.accountRoleLabel).toHaveText(account.label);
    });
  }
});
