import postgres from 'postgres';
import { test, expect } from '../fixtures/base-test';
import { ResidentsListPage } from '../page-objects/ResidentsListPage';
import { TEST_USERS } from '../fixtures/test-users';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * WO-NFR-PERF-SCREEN-LOAD (decyzja Michała 2026-10-30): lista podopiecznych stronicowana po 50.
 * Sortowanie działa na całej liście, a strona to wycinek po sortowaniu; wyszukiwanie wraca na stronę 1.
 * Warunek wstępny: placówka kierownika testowego ma więcej niż 50 podopiecznych.
 */
const PAGE_SIZE = 50;
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

test.describe('Stronicowanie listy podopiecznych (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  let total = 0;

  test.beforeAll(async () => {
    const sql = postgres(dbUrl!, { prepare: false });
    const [admin] = await sql`SELECT raw_app_meta_data->>'organization_id' AS org FROM auth.users WHERE email = ${TEST_USERS.org_admin.email}`;
    const [row] = await sql`SELECT count(*)::int AS n FROM public.residents WHERE organization_id = ${admin.org}`;
    total = row.n;
    await sql.end();
  });

  test('@REQ: UI-TEMPLATE-ALIGNMENT - pierwsza strona ma 50 wierszy, kolejna zaczyna się od 51', async ({ loginPage, page }) => {
    expect(total, 'placówka testowa musi mieć więcej niż 50 podopiecznych').toBeGreaterThan(PAGE_SIZE);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginPage.loginAs('org_admin');
    const list = new ResidentsListPage(page);
    await list.goto();

    await expect(list.rows).toHaveCount(PAGE_SIZE);
    await expect(list.paginationSummary).toContainText(`1–${PAGE_SIZE} z ${total}`);
    await expect(list.prevPageButton).toBeDisabled();

    const firstOnPage1 = await list.residentNames.first().textContent();
    await list.nextPageButton.click();
    await expect(list.paginationSummary).toContainText(`${PAGE_SIZE + 1}–${Math.min(2 * PAGE_SIZE, total)} z ${total}`);
    await expect(list.residentNames.first()).not.toHaveText(firstOnPage1 ?? '');
  });

  test('@REQ: UI-TEMPLATE-ALIGNMENT - wyszukiwanie wraca na pierwszą stronę', async ({ loginPage, page }) => {
    expect(total, 'placówka testowa musi mieć więcej niż 50 podopiecznych').toBeGreaterThan(PAGE_SIZE);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginPage.loginAs('org_admin');
    const list = new ResidentsListPage(page);
    await list.goto();

    await list.nextPageButton.click();
    await expect(list.paginationSummary).toContainText(`${PAGE_SIZE + 1}–`);
    await list.searchInput.first().fill('a');
    await expect(list.paginationSummary).toContainText('1–');
  });
});
