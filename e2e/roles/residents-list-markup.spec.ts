import { test, expect } from '../fixtures/base-test';
import { ResidentsListPage } from '../page-objects/ResidentsListPage';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * WO-NFR-PERF-SCREEN-LOAD: lista podopiecznych renderowała karty mobilne dla każdego podopiecznego także
 * na komputerze (ukryte CSS-em) — połowa z 2,1 MB HTML strony. Karty mobilne powstają tylko na małym ekranie,
 * tabela na większym; wygląd dla użytkownika bez zmian.
 */
test.describe('Lista podopiecznych bez zdublowanego widoku (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  test('@REQ: UI-TEMPLATE-ALIGNMENT - na komputerze w DOM jest tabela, bez kart mobilnych', async ({ loginPage, page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginPage.loginAs('org_admin');
    const list = new ResidentsListPage(page);
    await list.goto();

    await expect(list.rows.first()).toBeVisible();
    await expect(list.mobileCards).toHaveCount(0);
  });

  test('@REQ: UI-TEMPLATE-ALIGNMENT - na telefonie widać karty mobilne', async ({ loginPage, page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginPage.loginAs('org_admin');
    const list = new ResidentsListPage(page);
    await list.goto();

    await expect(list.mobileCards.first()).toBeVisible();
  });
});
