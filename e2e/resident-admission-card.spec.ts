import { test, expect } from './fixtures/base-test';
import { AdmissionWizardPage } from './page-objects/AdmissionWizardPage';

/**
 * @REQ: ADM-RESIDENT-ADD
 * @REQ: SEC-PESEL-HASH
 * @REQ: MDR-VOCABULARY
 *
 * Testy E2E dla kreatora przyjęcia pensjonariusza i karty podopiecznego:
 * AC1: Walidacja PESEL na kroku 1 (błąd przy złej sumie kontrolnej).
 * AC2: Etykieta ZSN jako "Znaczny stopień niepełnosprawności".
 */
test.describe('Kreator przyjęcia i karta podopiecznego (@REQ: ADM-RESIDENT-ADD, @REQ: SEC-PESEL-HASH, @REQ: MDR-VOCABULARY)', () => {
  test('@REQ: ADM-RESIDENT-ADD - AC1 & AC2: Walidacja PESEL w czasie rzeczywistym i poprawna definicja ZSN', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const wizardPage = new AdmissionWizardPage(page);
    await wizardPage.gotoResidents();

    // Otwarcie kreatora
    await wizardPage.openWizard();

    // AC2: Weryfikacja definicji ZSN
    await expect(wizardPage.zsnLabel).toContainText('Znaczny stopień niepełnosprawności');
    await expect(wizardPage.zsnLabel).not.toContainText('Zwiększone Zapotrzebowanie');

    // AC1: Wprowadzenie błędnego PESEL (niepoprawna suma kontrolna)
    await wizardPage.fillStep1('Jan', 'Kowalski', '52081203449');
    await expect(wizardPage.peselError).toBeVisible();
    await expect(wizardPage.peselError).toContainText('suma kontrolna');

    // Przycisk "Dalej" musi być zablokowany
    await expect(wizardPage.nextStepButton).toBeDisabled();

    // Wprowadzenie prawidłowego PESEL kobiety (52081203447)
    await wizardPage.peselInput.fill('52081203447');
    await expect(wizardPage.peselError).not.toBeVisible();
    await expect(page.locator('text=Kobieta')).toBeVisible();

    // Przycisk "Dalej" staje się aktywny
    await expect(wizardPage.nextStepButton).toBeEnabled();
  });
});
