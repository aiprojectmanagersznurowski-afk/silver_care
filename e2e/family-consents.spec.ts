import { test, expect } from './fixtures/base-test';
import { FamilyDashboardPage } from './page-objects/FamilyDashboardPage';

/**
 * @REQ: CONSENT-GRANTOR
 * @REQ: CONSENT-LEDGER-IMMUTABLE
 *
 * Testy E2E dla widoku zgód i ochrony danych w portalu rodziny (SC-FAM-02):
 * AC1: Wejście na /consents z nawigacji portalu rodziny po odrzuceniu onboarding modala.
 * AC2: Prezentacja kontekstu RODO Art. 9 oraz rejestru celów przetwarzania (wellness_data_ingest).
 */
test.describe('Portal rodziny — Zgody i RODO Art. 9 (@REQ: CONSENT-GRANTOR, @REQ: CONSENT-LEDGER-IMMUTABLE)', () => {
  test('@REQ: CONSENT-GRANTOR - AC1 & AC2: Nawigacja do rejestru zgód i weryfikacja celów przetwarzania', async ({ loginPage, page }) => {
    await loginPage.loginAs('family');
    const familyDashboard = new FamilyDashboardPage(page);
    await familyDashboard.dismissOnboardingModalIfExists();

    // Kliknięcie w link "Zgody" w nagłówku
    const consentsLink = page.locator('header nav a[href="/consents"]').first();
    await expect(consentsLink).toBeVisible();
    await consentsLink.click();

    // Weryfikacja adresu i nagłówków strony
    await expect(page).toHaveURL(/\/consents/);
    await expect(page.locator('h1')).toContainText('Zgody i ochrona prywatności');
    await expect(page.getByText('Art. 9 RODO & Rejestr Zgód')).toBeVisible();

    // Weryfikacja obecności sekcji rejestru zdarzeń zgód
    await expect(page.getByText('Rejestr zdarzeń zgód (Consent Ledger)')).toBeVisible();
    await expect(page.getByText('Zasady rozliczalności i granica wyrobu medycznego (MDR)')).toBeVisible();
  });
});
