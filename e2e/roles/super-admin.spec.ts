import { test, expect } from '../fixtures/base-test';

/**
 * @REQ: SUP-IAM-PANEL
 * @REQ: SUP-IMPERSONATION
 * @REQ: ORG-PROVISION
 *
 * Testy UI dla roli Super Admin (Operator platformy).
 */

test.describe('Rola: Super Admin (Operator Platformy)', () => {
  test('@REQ: ORG-PROVISION - Super Admin loguje się i widzi zarządzanie placówkami', async ({ loginPage, page }) => {
    await loginPage.loginAs('super_admin');

    // Super Admin jest automatycznie kierowany do modułu placówek
    await expect(page).toHaveURL(/\/admin\/organizations/);
    await expect(page.locator('h2:has-text("Zarządzanie Placówkami")')).toBeVisible();

    // Sprawdzenie obecności tabeli lub listy placówek
    await expect(page.locator('text=Główna Placówka Opiekuńcza').first()).toBeVisible();
  });

  test('@REQ: SUP-IAM-PANEL - Super Admin zarządza uprawnieniami w panelu IAM i przegląda rejestr audytowy', async ({ loginPage, adminDashboardPage, page }) => {
    await loginPage.loginAs('super_admin');

    // Przejście do panelu uprawnień IAM
    await adminDashboardPage.navigateToIam();
    await expect(page).toHaveURL(/\/admin\/iam/);
    await expect(page.locator('h2:has-text("Zarządzanie Dostępem i Tożsamością (IAM)")')).toBeVisible();

    // Przejście do rejestru audytowego
    await adminDashboardPage.navigateToAudit();
    await expect(page).toHaveURL(/\/admin\/audit/);
    await expect(page.locator('h2:has-text("Rejestr Audytowy")')).toBeVisible();

    // Wylogowanie
    await adminDashboardPage.logout();
    await expect(page).toHaveURL(/\/login/);
  });
});
