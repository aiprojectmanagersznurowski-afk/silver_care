import postgres from 'postgres';
import { test, expect } from '../fixtures/base-test';
import { ShiftTasksPage } from '../page-objects/ShiftTasksPage';
import { TEST_USERS } from '../fixtures/test-users';

/**
 * @REQ: NUR-TASKS
 *
 * SC-NUR-13/15: lista zadań zmiany — dodawanie ręczne (kierownik placówki: od razu „Do zrobienia”, personel: „Propozycja”),
 * źródło zadania widoczne, grupowanie per pokój i per podopieczny. Test tworzy własną zmianę „E2E Zadania”
 * i zadania z prefiksem „E2E ”, kasowane po teście.
 */
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const PREFIX = 'E2E ';
const CODE = 'E2E-ZADANIA';
const DATE = '2026-11-09';

test.describe('Zadania zmiany (@REQ: NUR-TASKS)', () => {
  test.describe.configure({ mode: 'serial' });
  let sql: postgres.Sql;
  let orgId = '';
  let resident: { id: string; name: string } = { id: '', name: '' };

  test.beforeAll(async () => {
    sql = postgres(dbUrl!, { prepare: false });
    const [admin] = await sql`SELECT raw_app_meta_data->>'organization_id' AS org FROM auth.users WHERE email = ${TEST_USERS.org_admin.email}`;
    orgId = admin.org;
    const [r] = await sql`SELECT id::text AS id, first_name || ' ' || last_name AS name FROM public.residents
      WHERE organization_id = ${orgId} AND archived_at IS NULL ORDER BY last_name LIMIT 1`;
    resident = { id: r.id, name: r.name };
    await sql`DELETE FROM public.shift_definitions WHERE organization_id = ${orgId} AND name LIKE ${PREFIX + '%'}`;
    await sql`INSERT INTO public.shift_definitions (organization_id, code, name, start_time, end_time, order_index)
      VALUES (${orgId}, ${CODE}, ${PREFIX + 'Zadania'}, '07:00', '19:00', 903)`;
  });

  test.afterAll(async () => {
    await sql`DELETE FROM public.shift_definitions WHERE organization_id = ${orgId} AND name LIKE ${PREFIX + '%'}`;
    await sql.end();
  });

  test('@REQ: NUR-TASKS - kierownik placówki dodaje zadanie dla podopiecznego i zadanie placówki; widać źródło i status', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const tasks = new ShiftTasksPage(page);
    await tasks.goto(CODE, DATE);

    await tasks.addTask('E2E Zmierzyć ilość płynów', resident.id);
    await expect(tasks.task('E2E Zmierzyć ilość płynów')).toContainText('Do zrobienia');
    await expect(tasks.task('E2E Zmierzyć ilość płynów')).toContainText('Ręczne');

    await tasks.addTask('E2E Przewietrzyć świetlicę');
    await expect(tasks.group('Zadania placówki')).toContainText('E2E Przewietrzyć świetlicę');
  });

  test('@REQ: NUR-TASKS - lista grupuje się według pokoi albo podopiecznych', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const tasks = new ShiftTasksPage(page);
    await tasks.goto(CODE, DATE);

    await expect(tasks.group(/Pokój|Zadania placówki/).first()).toBeVisible();
    await tasks.byResidentLink.click();
    await expect(page).toHaveURL(/group=resident/);
    await expect(tasks.group(resident.name)).toContainText('E2E Zmierzyć ilość płynów');
    await tasks.byRoomLink.click();
    await expect(page).toHaveURL(/group=room/);
  });

  test('@REQ: NUR-TASKS - personel opiekuńczy dodaje wyłącznie propozycję', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    const tasks = new ShiftTasksPage(page);
    await tasks.goto(CODE, DATE);

    await tasks.addTask('E2E Pomóc przy kolacji', resident.id);
    await expect(tasks.task('E2E Pomóc przy kolacji')).toContainText('Propozycja');
  });
});
