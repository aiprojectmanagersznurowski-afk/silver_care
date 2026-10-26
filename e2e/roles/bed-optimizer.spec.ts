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
});
