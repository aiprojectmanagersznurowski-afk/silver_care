import { test, expect } from '../fixtures/base-test';
import { ResidentProfilePage } from '../page-objects/ResidentProfilePage';
import { AdmissionWizardPage } from '../page-objects/AdmissionWizardPage';

/**
 * @REQ: ADM-RESIDENT-FUNDING
 *
 * SC-ADM-24: karta kierownika pokazuje osobno źródło pozyskania (dawne contract_source) i źródło
 * finansowania (resident_funding). Brak wartości to „Brak danych”, nigdy zmyślone „private”.
 */
const FUNDING_VALUES = ['Prywatnie (podopieczny lub rodzina)', 'Gmina / MOPS', 'Współfinansowanie (prywatnie + gmina)', 'Inne', 'Brak danych'];
const ACQUISITION_VALUES = ['Internet', 'Polecenie', 'Szpital', 'MOPS', 'Polecenie rodziny', 'Inne', 'Brak danych'];

test.describe('Źródło finansowania na karcie podopiecznego (@REQ: ADM-RESIDENT-FUNDING)', () => {
  test('@REQ: ADM-RESIDENT-FUNDING - kierownik widzi źródło pozyskania i źródło finansowania z jawnym brakiem danych', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    await page.setViewportSize({ width: 1440, height: 900 });
    const profile = new ResidentProfilePage(page);
    await profile.openFirstFromList();

    const acquisition = profile.sidebar.locator('[data-testid="contract-source"]');
    const funding = profile.sidebar.locator('[data-testid="funding-source"]');

    await expect(acquisition.locator('[data-slot="field-label"]')).toHaveText('Źródło pozyskania');
    await expect(funding.locator('[data-slot="field-label"]')).toHaveText('Źródło finansowania');

    expect(ACQUISITION_VALUES).toContain((await acquisition.locator('[data-slot="field-value"]').innerText()).trim());
    expect(FUNDING_VALUES).toContain((await funding.locator('[data-slot="field-value"]').innerText()).trim());
    await expect(profile.sidebar).not.toContainText(/\bprivate\b/);
  });

  // Decyzja Michała 2026-11-17: pola karty edytuje się w oknie „Edytuj” (resident-edit-dialog.spec), widok karty tylko je pokazuje
  test('@REQ: ADM-RESIDENT-FUNDING - widok karty bez przycisku „Zmień” przy źródle finansowania', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    await page.setViewportSize({ width: 1440, height: 900 });
    const profile = new ResidentProfilePage(page);
    await profile.openFirstFromList();

    const funding = profile.sidebar.locator('[data-testid="funding-source"]');
    await expect(funding.locator('[data-slot="field-value"]')).toBeVisible();
    await expect(profile.sidebar.getByRole('button', { name: /Zmień/ })).toHaveCount(0);
    await expect(funding.getByRole('combobox')).toHaveCount(0);
  });

  // Kreator nie kończy przyjęcia: przyjęcie zmienia liczbę podopiecznych placówki testowej, na której
  // opiera się admin-capacity-limit.spec (wyścig przy równoległych workerach). Zapis po przyjęciu idzie przez
  // updateResidentFundingAction (tests/logic/resident_funding_action.test.ts), a zapis z UI pokrywa test „Zmień”.
  test('@REQ: ADM-RESIDENT-FUNDING - kreator przyjęcia ma opcjonalne źródło finansowania bez wartości domyślnej', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const wizard = new AdmissionWizardPage(page);
    await wizard.gotoResidents();
    await wizard.openWizard();

    const fundingSelect = page.getByRole('combobox', { name: 'Źródło finansowania (opcjonalnie)' });
    await expect(fundingSelect).toHaveValue('');
    expect((await fundingSelect.locator('option').allInnerTexts()).map((t) => t.trim())).toEqual([
      'Brak danych — uzupełnię później',
      'Prywatnie (podopieczny lub rodzina)',
      'Gmina / MOPS',
      'Współfinansowanie (prywatnie + gmina)',
      'Inne',
    ]);
    await fundingSelect.selectOption({ label: 'Gmina / MOPS' });
    await expect(fundingSelect).toHaveValue('municipality');
  });
});
