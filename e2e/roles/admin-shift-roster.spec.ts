import postgres from 'postgres';
import { test, expect } from '../fixtures/base-test';
import { ShiftsPage } from '../page-objects/ShiftsPage';
import { TEST_USERS } from '../fixtures/test-users';

/**
 * @REQ: NUR-SHIFT-CONFIG
 * @REQ: NUR-SHIFT-LEAD
 *
 * SC-NUR-12/AC1a: kierownik placówki układa tygodniowy grafik i wyznacza jednego kierownika zmiany na zmianę i dzień.
 * Test tworzy własne zmiany z prefiksem „E2E ” (kasowane po teście razem z grafikiem) i używa stałego tygodnia w przyszłości.
 */
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const PREFIX = 'E2E ';
const WEEK = '2026-11-02';
const DAY = '2026-11-02';
const DAY_CODE = 'E2E-DZIENNA';

test.describe('Grafik zmian (@REQ: NUR-SHIFT-LEAD)', () => {
  test.describe.configure({ mode: 'serial' });
  let sql: postgres.Sql;
  let orgId = '';
  let nurses: { id: string; email: string }[] = [];

  test.beforeAll(async () => {
    sql = postgres(dbUrl!, { prepare: false });
    const [admin] = await sql`SELECT raw_app_meta_data->>'organization_id' AS org FROM auth.users WHERE email = ${TEST_USERS.org_admin.email}`;
    orgId = admin.org;
    nurses = await sql`SELECT id::text AS id, email FROM auth.users
      WHERE raw_app_meta_data->>'organization_id' = ${orgId} AND raw_app_meta_data->>'role' = 'nurse' AND COALESCE(raw_app_meta_data->>'is_active', 'true') <> 'false'
      ORDER BY email LIMIT 2` as unknown as { id: string; email: string }[];
    await sql`DELETE FROM public.shift_definitions WHERE organization_id = ${orgId} AND name LIKE ${PREFIX + '%'}`;
    await sql`INSERT INTO public.shift_definitions (organization_id, code, name, start_time, end_time, order_index) VALUES
      (${orgId}, ${DAY_CODE}, ${PREFIX + 'Dzienna'}, '07:00', '19:00', 901), (${orgId}, ${'E2E-NOCNA'}, ${PREFIX + 'Nocna'}, '19:00', '07:00', 902)`;
  });

  test.afterAll(async () => {
    await sql`DELETE FROM public.shift_definitions WHERE organization_id = ${orgId} AND name LIKE ${PREFIX + '%'}`;
    await sql.end();
  });

  test('@REQ: NUR-SHIFT-LEAD - kierownik placówki wpisuje personel do grafiku i wyznacza jednego kierownika zmiany', async ({ loginPage, page }) => {
    expect(nurses.length, 'placówka testowa musi mieć co najmniej 2 aktywne osoby z personelu opiekuńczego').toBe(2);
    const [a, b] = nurses;
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginPage.loginAs('org_admin');
    const shifts = new ShiftsPage(page);
    await page.goto(`/admin/shifts?week=${WEEK}`);
    await shifts.expectLoaded();
    await expect(shifts.weekLabel).toContainText('2.11–8.11.2026');

    await shifts.addToRoster(DAY, DAY_CODE, a.id);
    await expect(shifts.entry(DAY, DAY_CODE, a.email)).toBeVisible();
    await shifts.addToRoster(DAY, DAY_CODE, b.id);
    await expect(shifts.entry(DAY, DAY_CODE, b.email)).toBeVisible();

    await shifts.entry(DAY, DAY_CODE, a.email).getByRole('button', { name: /jako kierownika zmiany/ }).click();
    await expect(shifts.entry(DAY, DAY_CODE, a.email)).toContainText('Kierownik zmiany');

    // Wyznaczenie drugiej osoby przenosi funkcję — w komórce jest dokładnie jeden kierownik
    await shifts.entry(DAY, DAY_CODE, b.email).getByRole('button', { name: /jako kierownika zmiany/ }).click();
    await expect(shifts.entry(DAY, DAY_CODE, b.email)).toContainText('Kierownik zmiany');
    await expect(shifts.entry(DAY, DAY_CODE, a.email)).not.toContainText('Kierownik zmiany');
    await expect(shifts.cell(DAY, DAY_CODE).getByText('Kierownik zmiany', { exact: true })).toHaveCount(1);

    await shifts.entry(DAY, DAY_CODE, a.email).getByRole('button', { name: /z grafiku/ }).click();
    await expect(shifts.entry(DAY, DAY_CODE, a.email)).toHaveCount(0);
  });

  test('@REQ: NUR-SHIFT-CONFIG - nawigacja po tygodniach zachowuje wpisy', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const shifts = new ShiftsPage(page);
    await page.goto(`/admin/shifts?week=${WEEK}`);
    await shifts.nextWeekLink.click();
    await expect(page).toHaveURL(/week=2026-11-09/);
    await expect(shifts.weekLabel).toContainText('9.11–15.11.2026');
    await shifts.prevWeekLink.click();
    await expect(shifts.weekLabel).toContainText('2.11–8.11.2026');
    await expect(shifts.cell(DAY, DAY_CODE)).toBeVisible();
  });
});
