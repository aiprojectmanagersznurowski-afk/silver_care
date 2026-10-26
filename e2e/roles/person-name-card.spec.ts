import { test, expect } from '../fixtures/base-test';
import { ResidentsListPage } from '../page-objects/ResidentsListPage';
import { ResidentProfilePage } from '../page-objects/ResidentProfilePage';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * Karta podopiecznego pokazuje „Nazwisko Imię” — tak samo jak lista podopiecznych (decyzja Michała 2026-10-26).
 */
test.describe('Karta podopiecznego — Nazwisko Imię (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  test('@REQ: UI-TEMPLATE-ALIGNMENT - nagłówek karty = nazwa z listy', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const list = new ResidentsListPage(page);
    await list.goto();

    const name = (await list.residentNames.first().innerText()).trim();
    await list.residentNames.first().click();
    await page.waitForURL(/\/admin\/residents\/[a-f0-9-]+/);

    const card = new ResidentProfilePage(page);
    await expect(card.heading).toHaveText(name);
  });
});
