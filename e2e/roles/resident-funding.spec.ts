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

  test('@REQ: ADM-RESIDENT-FUNDING - kierownik zmienia źródło finansowania przyciskiem „Zmień” na karcie', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    await page.setViewportSize({ width: 1440, height: 900 });
    const profile = new ResidentProfilePage(page);
    await profile.openFirstFromList();

    const funding = profile.sidebar.locator('[data-testid="funding-source"]');
    const current = (await funding.locator('[data-slot="field-value"]').innerText()).trim();
    const target = current === 'Gmina / MOPS' ? 'Inne' : 'Gmina / MOPS';

    await funding.getByRole('button', { name: 'Zmień źródło finansowania' }).click();
    await funding.getByRole('combobox', { name: 'Źródło finansowania' }).selectOption({ label: target });
    await funding.getByRole('button', { name: 'Zapisz' }).click();

    await expect(funding.locator('[data-slot="field-value"]')).toHaveText(target);
    await page.reload();
    await expect(profile.sidebar.locator('[data-testid="funding-source"] [data-slot="field-value"]')).toHaveText(target);
  });

  test('@REQ: ADM-RESIDENT-FUNDING - kreator przyjęcia zapisuje opcjonalne źródło finansowania', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    await page.setViewportSize({ width: 1440, height: 900 });
    const wizard = new AdmissionWizardPage(page);
    await wizard.gotoResidents();
    await wizard.openWizard();
    await wizard.fillStep1('Zofia', 'Finansowa-E2E', randomValidPesel());

    const fundingSelect = page.getByRole('combobox', { name: 'Źródło finansowania (opcjonalnie)' });
    await expect(fundingSelect).toHaveValue('');
    await fundingSelect.selectOption({ label: 'Współfinansowanie (prywatnie + gmina)' });

    await wizard.goToSummaryWithoutBed();
    await wizard.submitAdmissionButton.click();
    const goToProfile = page.getByRole('link', { name: /Przejdź do profilu podopiecznego/ });
    await expect(goToProfile.or(wizard.capacityWarning)).toBeVisible();
    if (await wizard.capacityWarning.isVisible()) {
      await wizard.capacityConfirmCheckbox.check();
      await wizard.submitAdmissionButton.click();
    }
    await goToProfile.click();

    const profile = new ResidentProfilePage(page);
    await expect(profile.sidebar.locator('[data-testid="funding-source"] [data-slot="field-value"]')).toHaveText('Współfinansowanie (prywatnie + gmina)');
  });
});

/** Poprawny PESEL kobiety urodzonej w 1950 r. z losowym numerem serii (jak w admin-capacity-limit.spec). */
function randomValidPesel(): string {
  const serial = String(Math.floor(Math.random() * 900) + 100);
  const base = `500101${serial}2`;
  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const sum = base.split('').reduce((s, d, i) => s + Number(d) * weights[i], 0);
  return base + String((10 - (sum % 10)) % 10);
}
