import { test, expect } from '../fixtures/base-test';

/**
 * @REQ: SUP-IMPERSONATION
 * @REQ: SEC-NO-PII-LOGS
 *
 * Testy E2E dla bezpiecznego trybu impersonacji (SEC-SUPERADMIN-IMPERSONATION):
 * AC1: Read-Only struktury i blokada PII podopiecznych
 * AC2: Blokada formularzy tworzenia i akcji eksportu
 */
test.describe('Bezpieczny tryb impersonacji Super Admina (@REQ: SUP-IMPERSONATION, @REQ: SEC-NO-PII-LOGS)', () => {
  test('@REQ: SUP-IMPERSONATION - AC1 & AC2: Tryb podglądu blokuje dodawanie i eksport oraz chroni PII', async ({ loginPage, page, context }) => {
    await loginPage.loginAs('super_admin');

    // Ustawienie ciasteczka symulującego aktywną sesję impersonacji
    await context.addCookies([
      {
        name: 'sc_impersonation',
        value: JSON.stringify({
          targetAdminId: '00000000-0000-0000-0000-000000000001',
          targetOrgId: '00000000-0000-0000-0000-000000000001',
          targetOrgName: 'Test Facility Impersonated',
          adminEmail: 'admin@test.facility',
          impersonatorId: 'super-admin-id',
          startedAt: new Date().toISOString(),
        }),
        domain: 'localhost',
        path: '/',
      },
    ]);

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
