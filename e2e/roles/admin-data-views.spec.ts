import { test, expect } from '../fixtures/base-test';
import { AdminDataViewsPage } from '../page-objects/AdminDataViewsPage';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * PR 2/4 (ADR-014): widoki danych panelu administratora na komponentach szablonu.
 */

const TABLE_PAGES = ['/admin/residents', '/admin/staff'];

test.describe('Panel administratora — komponenty szablonu (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  for (const path of TABLE_PAGES) {
    test(`@REQ: UI-TEMPLATE-ALIGNMENT - ${path}: tabela z ui/table, bez surowych <table>`, async ({ loginPage, page }) => {
      await loginPage.loginAs('org_admin');
      const views = new AdminDataViewsPage(page);
      await views.goto(path);
      await views.expectTableFromTemplate();
      await expect(views.rawSelects).toHaveCount(0);
    });
  }

  test('@REQ: UI-TEMPLATE-ALIGNMENT - statystyka placówki rysuje wykresy z ui/chart albo stan pusty', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const views = new AdminDataViewsPage(page);
    await views.goto('/admin/reports/statistics');

    await expect(page.locator('h2:has-text("Statystyka")')).toBeVisible();
    const chartCount = await views.charts.count();
    const emptyCount = await page.locator('text=Brak danych').count();
    expect(chartCount + emptyCount).toBeGreaterThan(0);
    // Wykresy Nivo renderowały własne SVG bez data-slot
    await expect(page.locator('svg[role="img"]:not([data-slot])')).toHaveCount(0);
  });

  test('@REQ: UI-TEMPLATE-ALIGNMENT - rejestr audytowy w tabeli z szablonu', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const views = new AdminDataViewsPage(page);
    await views.goto('/admin/audit');
    await expect(views.rawTables).toHaveCount(0);
  });
});
