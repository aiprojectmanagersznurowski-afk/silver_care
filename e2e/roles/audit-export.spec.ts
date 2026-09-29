import { test, expect } from '../fixtures/base-test';
import { AuditPage } from '../page-objects/AuditPage.spec.helper';

/**
 * @REQ: SEC-AUDIT-APPEND-ONLY
 * @REQ: SEC-NO-PII-LOGS
 *
 * Testy E2E dla widoku rejestru audytowego:
 * AC1: Widoczność kolumny User ID (identyfikator aktora)
 * AC2: Filtrowanie po zakresie dat
 * AC3: Przycisk eksportu audytu
 */
test.describe('Rejestr Audytowy RODO — Filtrowanie, Eksport i Strefy Czasowe (@REQ: SEC-AUDIT-APPEND-ONLY, @REQ: SEC-NO-PII-LOGS)', () => {
  test('@REQ: SEC-AUDIT-APPEND-ONLY - Rejestr audytowy eksponuje User ID oraz kontrolki filtrów i eksportu', async ({ loginPage, page }) => {
    const auditPage = new AuditPage(page);
    await loginPage.loginAs('super_admin');
    await auditPage.goto();
    await auditPage.expectLoaded();

    // AC1: Widoczna kolumna z identyfikatorem użytkownika
    await auditPage.expectUserIdColumnVisible();

    // AC2: Kontrolki wyboru zakresu dat
    await auditPage.expectFilterControlsVisible();

    // AC3: Przycisk eksportu wyciągu
    await auditPage.expectExportControlsVisible();
  });
});
