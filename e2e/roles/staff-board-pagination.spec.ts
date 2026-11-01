import postgres from 'postgres';
import { test, expect } from '../fixtures/base-test';
import { TEST_USERS } from '../fixtures/test-users';

/**
 * @REQ: NUR-BOARD
 *
 * WO-NFR-PERF-SCREEN-LOAD: tablica dyżuru (/staff) w widoku tabeli stronicowana po 50, tak jak lista podopiecznych
 * (decyzja Michała 2026-10-30). Sortowanie działa na całej liście, strona to wycinek po sortowaniu;
 * wyszukiwanie wraca na pierwszą stronę. Warunek wstępny: placówka personelu testowego ma ponad 50 podopiecznych.
 */
const PAGE_SIZE = 50;
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

test.describe('Stronicowanie tablicy dyżuru (@REQ: NUR-BOARD)', () => {
  let total = 0;

  test.beforeAll(async () => {
    const sql = postgres(dbUrl!, { prepare: false });
    const [nurse] = await sql`SELECT raw_app_meta_data->>'organization_id' AS org FROM auth.users WHERE email = ${TEST_USERS.nurse.email}`;
    const [row] = await sql`SELECT count(*)::int AS n FROM public.residents WHERE organization_id = ${nurse.org} AND archived_at IS NULL`;
    total = row.n;
    await sql.end();
  });

  test('@REQ: NUR-BOARD - pierwsza strona ma 50 wierszy, druga zaczyna się od 51', async ({ loginPage, staffBoardPage, page }) => {
    expect(total, 'placówka personelu testowego musi mieć więcej niż 50 podopiecznych').toBeGreaterThan(PAGE_SIZE);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginPage.loginAs('nurse');
    await staffBoardPage.goto();
    await staffBoardPage.expectStaffBoardLoaded();

    await expect(staffBoardPage.tableRows).toHaveCount(PAGE_SIZE);
    await expect(staffBoardPage.paginationSummary).toContainText(`1–${PAGE_SIZE} z ${total}`);
    await expect(staffBoardPage.prevPageButton).toBeDisabled();

    const firstOnPage1 = (await staffBoardPage.tableResidentNames())[0];
    await staffBoardPage.nextPageButton.click();
    await expect(staffBoardPage.paginationSummary).toContainText(`${PAGE_SIZE + 1}–${Math.min(2 * PAGE_SIZE, total)} z ${total}`);
    expect((await staffBoardPage.tableResidentNames())[0]).not.toBe(firstOnPage1);
  });

  test('@REQ: NUR-BOARD - wyszukiwanie wraca na pierwszą stronę i znajduje podopiecznego z dalszej strony', async ({ loginPage, staffBoardPage, page }) => {
    expect(total, 'placówka personelu testowego musi mieć więcej niż 50 podopiecznych').toBeGreaterThan(PAGE_SIZE);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginPage.loginAs('nurse');
    await staffBoardPage.goto();
    await staffBoardPage.expectStaffBoardLoaded();

    await staffBoardPage.nextPageButton.click();
    const lastPageNames = await staffBoardPage.tableResidentNames();
    const target = lastPageNames[lastPageNames.length - 1];
    await expect(staffBoardPage.paginationSummary).toContainText(`${PAGE_SIZE + 1}–`);

    await staffBoardPage.searchResident(target);
    await expect(staffBoardPage.paginationSummary).toHaveCount(0);
    await expect(staffBoardPage.tableRows.filter({ hasText: target }).first()).toBeVisible();
  });
});
