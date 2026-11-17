import { test, expect } from '../fixtures/base-test';
import { ResidentProfilePage } from '../page-objects/ResidentProfilePage';

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
});
