import { test, expect } from '../fixtures/base-test';
import { ResidentProfilePage } from '../page-objects/ResidentProfilePage';

/**
 * @REQ: ADM-RESIDENT-FUNDING
 *
 * Pola karty podopiecznego edytuje się w oknie „Edytuj” (decyzja Michała 2026-11-17):
 * źródło pozyskania i źródło finansowania zapisują się z okna, a karta pokazuje nowe wartości.
 */
test.describe('Okno „Edytuj” karty podopiecznego (@REQ: ADM-RESIDENT-FUNDING)', () => {
  test('@REQ: ADM-RESIDENT-FUNDING - źródło pozyskania i finansowania zmienia się w oknie „Edytuj”', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    await page.setViewportSize({ width: 1440, height: 900 });
    const profile = new ResidentProfilePage(page);
    await profile.openFirstFromList();

    const acquisitionValue = profile.sidebar.locator('[data-testid="contract-source"] [data-slot="field-value"]');
    const fundingValue = profile.sidebar.locator('[data-testid="funding-source"] [data-slot="field-value"]');
    const acquisitionTarget = (await acquisitionValue.innerText()).trim() === 'Szpital' ? 'Internet' : 'Szpital';
    const fundingTarget = (await fundingValue.innerText()).trim() === 'Gmina / MOPS' ? 'Inne' : 'Gmina / MOPS';

    await page.getByTestId('edit-resident-btn').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Źródło pozyskania').selectOption({ label: acquisitionTarget });
    await dialog.getByLabel('Źródło finansowania').selectOption({ label: fundingTarget });
    await dialog.getByRole('button', { name: 'Zapisz zmiany' }).click();
    await expect(dialog).toBeHidden();

    await expect(acquisitionValue).toHaveText(acquisitionTarget);
    await expect(fundingValue).toHaveText(fundingTarget);
    await page.reload();
    await expect(profile.sidebar.locator('[data-testid="contract-source"] [data-slot="field-value"]')).toHaveText(acquisitionTarget);
    await expect(profile.sidebar.locator('[data-testid="funding-source"] [data-slot="field-value"]')).toHaveText(fundingTarget);
  });
});
