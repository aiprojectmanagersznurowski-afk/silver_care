import { test, expect } from '../fixtures/base-test';
import { MAIN_ORG_ID } from '../fixtures/test-users';

/**
 * @REQ: SUP-IMPERSONATION
 * @REQ: SEC-NO-PII-LOGS
 *
 * Testy E2E dla bezpiecznego trybu impersonacji (SEC-SUPERADMIN-IMPERSONATION):
 * AC1: Read-Only struktury i blokada PII podopiecznych
 * AC2: Blokada formularzy tworzenia i akcji eksportu
 */
test.describe('Bezpieczny tryb impersonacji Super Admina (@REQ: SUP-IMPERSONATION, @REQ: SEC-NO-PII-LOGS)', () => {
  test('@REQ: SUP-IMPERSONATION - AC1 & AC2: Tryb podglądu blokuje dodawanie i eksport oraz chroni PII', async ({ loginPage, page }) => {
    await loginPage.loginAs('super_admin');

    // Prawdziwa ścieżka: „Zaloguj jako" przy administratorze placówki ustawia ciasteczko powiązane z tym super adminem
    await page.goto(`/admin/organizations/${MAIN_ORG_ID}`);
    await page.getByRole('button', { name: 'Zaloguj jako' }).first().click();
    await page.waitForURL('**/admin');

    await page.goto('/admin/residents');
    await page.waitForLoadState('networkidle');

    // AC1: Weryfikacja banneru lub komunikatu informującego o trybie podglądu / ochronie PII
    const impersonationNotice = page.locator('text=Tryb podglądu').first();
    await expect(impersonationNotice).toBeVisible();

    // AC2: Weryfikacja braku przycisków dodawania podopiecznego i eksportu
    const addResidentBtn = page.locator('button:has-text("Dodaj podopiecznego"), button:has-text("Kreator przyjęcia")');
    await expect(addResidentBtn).not.toBeVisible();

    const exportBtn = page.locator('button:has-text("Eksport danych")');
    await expect(exportBtn).not.toBeVisible();
  });
});
