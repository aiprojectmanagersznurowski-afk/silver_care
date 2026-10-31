import { test, expect } from '../fixtures/base-test';
import { FacilityPage } from '../page-objects/FacilityPage';

/**
 * @REQ: ADM-BED-ASSIGNMENT
 *
 * Optymalizator przydziału łóżek (decyzje Michała 2026-10-26): przycisk „Optymalizuj przydział łóżek”
 * bez dopisku „AI”; propozycja to pole wyboru z trasą „skąd → dokąd”, pod nią podopieczny (Nazwisko Imię)
 * i uzasadnienie. Test tylko czyta propozycje — niczego nie przenosi.
 */
test.describe('Optymalizator przydziału łóżek (@REQ: ADM-BED-ASSIGNMENT)', () => {
  test('@REQ: ADM-BED-ASSIGNMENT - przycisk, trasa skąd → dokąd i pełne dane podopiecznego', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const facility = new FacilityPage(page);
    await facility.goto();

    await expect(facility.optimizerButton).toBeVisible();
    await expect(page.getByRole('button', { name: /\(AI\)/ })).toHaveCount(0);

    await facility.openOptimizer();
    const count = await facility.optimizerSuggestions.count();
    for (let i = 0; i < count; i++) {
      const item = facility.optimizerSuggestions.nth(i);
      await expect(item.getByRole('checkbox')).toBeVisible();
      await expect(item.locator('[data-testid="bed-optimizer-route"]')).toHaveText(/^Pokój .+ → Pokój .+$/);
      const name = (await item.locator('[data-testid="bed-optimizer-resident"]').innerText()).trim();
      expect(name).not.toMatch(/^[A-Z?]\. [A-Z?]\./);
      await expect(item.locator('[data-testid="bed-optimizer-reason"]')).not.toBeEmpty();
    }
  });

  test('@REQ: ADM-BED-ASSIGNMENT - przycisk posiada tooltip z opisem działania algorytmu', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const facility = new FacilityPage(page);
    await facility.goto();

    await expect(facility.optimizerButton).toBeVisible();
    await facility.optimizerButton.hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Analizuje obłożenie pod kątem zgodności płciowej i mobilności podopiecznych');
  });

  test('@REQ: ADM-BED-ASSIGNMENT - panel ustawień placówki posiada przełączniki reguł przydziału łóżek', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toHaveText('Ustawienia placówki');
    await expect(page.getByText('Reguły przydziału łóżek')).toBeVisible();
    await expect(page.getByLabel('Wymuszaj zgodność płciową w pokojach wieloosobowych')).toBeVisible();
    await expect(page.getByLabel('Preferuj parter dla osób leżących i ZSN')).toBeVisible();
  });
});
