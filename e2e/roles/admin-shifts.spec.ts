import postgres from 'postgres';
import { test, expect } from '../fixtures/base-test';
import { ShiftsPage } from '../page-objects/ShiftsPage';
import { TEST_USERS } from '../fixtures/test-users';

/**
 * @REQ: NUR-SHIFT-CONFIG
 *
 * SC-NUR-12/AC1: kierownik placówki definiuje 2 albo 3 zmiany na dobę; zmiana nocna przechodzi przez północ;
 * czwartej aktywnej zmiany nie da się dodać. Zmiany testowe mają prefiks „E2E ” i są usuwane po teście.
 * Warunek wstępny: placówka kierownika testowego nie ma innych aktywnych zmian.
 */
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const PREFIX = 'E2E ';

test.describe('Zmiany placówki (@REQ: NUR-SHIFT-CONFIG)', () => {
  test.describe.configure({ mode: 'serial' });
  let sql: postgres.Sql;
  let orgId = '';

  test.beforeAll(async () => {
    sql = postgres(dbUrl!, { prepare: false });
    const [admin] = await sql`SELECT raw_app_meta_data->>'organization_id' AS org FROM auth.users WHERE email = ${TEST_USERS.org_admin.email}`;
    orgId = admin.org;
    await sql`DELETE FROM public.shift_definitions WHERE organization_id = ${orgId} AND name LIKE ${PREFIX + '%'}`;
  });

  test.afterAll(async () => {
    await sql`DELETE FROM public.shift_definitions WHERE organization_id = ${orgId} AND name LIKE ${PREFIX + '%'}`;
    await sql.end();
  });

  test('@REQ: NUR-SHIFT-CONFIG - kierownik dodaje zmianę dzienną i nocną; nocna oznaczona jako przechodząca przez północ', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const shifts = new ShiftsPage(page);
    await shifts.goto();
    await shifts.expectLoaded();

    await shifts.addShift('E2E Dzienna', '07:00', '19:00');
    await expect(shifts.rowFor('E2E Dzienna')).toContainText('07:00–19:00');
    await shifts.addShift('E2E Nocna', '19:00', '07:00');
    await expect(shifts.rowFor('E2E Nocna')).toContainText('19:00–07:00 (przez północ)');
    await expect(shifts.countHint).toContainText('2');
  });

  test('@REQ: NUR-SHIFT-CONFIG - czwartej aktywnej zmiany nie da się dodać; dezaktywacja zwalnia miejsce', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const shifts = new ShiftsPage(page);
    await shifts.goto();

    await shifts.addShift('E2E Popołudniowa', '15:00', '23:00');
    await expect(shifts.rowFor('E2E Popołudniowa')).toBeVisible();

    await shifts.addShift('E2E Czwarta', '01:00', '05:00');
    await expect(shifts.formError).toContainText('3');
    await page.keyboard.press('Escape');
    await expect(shifts.rowFor('E2E Czwarta')).toHaveCount(0);

    await shifts.toggleActive('E2E Popołudniowa');
    await expect(shifts.rowFor('E2E Popołudniowa')).toContainText('Nieaktywna');
  });

  test('@REQ: NUR-SHIFT-CONFIG - personel opiekuńczy nie ma dostępu do konfiguracji zmian', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    await page.goto('/admin/shifts');
    await expect(page).not.toHaveURL(/\/admin\/shifts/);
  });
});
