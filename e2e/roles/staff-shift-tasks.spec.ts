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
const CODE_2 = 'E2E-ZADANIA-N';
const DATE = '2026-11-09';
const SETTLE_DATE = '2026-11-10';
const PRINT_DATE = SETTLE_DATE;

test.describe('Zadania zmiany (@REQ: NUR-TASKS)', () => {
  test.describe.configure({ mode: 'serial' });
  let sql: postgres.Sql;
  let orgId = '';
  let resident: { id: string; name: string } = { id: '', name: '' };

  test.beforeAll(async () => {
    sql = postgres(dbUrl!, { prepare: false });
    const [admin] = await sql`SELECT raw_app_meta_data->>'organization_id' AS org FROM auth.users WHERE email = ${TEST_USERS.org_admin.email}`;
    orgId = admin.org;
    const [r] = await sql`SELECT id::text AS id, last_name || ' ' || first_name AS name FROM public.residents
      WHERE organization_id = ${orgId} AND archived_at IS NULL ORDER BY last_name LIMIT 1`;
    resident = { id: r.id, name: r.name };
    await sql`DELETE FROM public.shift_definitions WHERE organization_id = ${orgId} AND name LIKE ${PREFIX + '%'}`;
    await sql`INSERT INTO public.shift_definitions (organization_id, code, name, start_time, end_time, order_index)
      VALUES (${orgId}, ${CODE}, ${PREFIX + 'Zadania'}, '07:00', '19:00', 903), (${orgId}, ${CODE_2}, ${PREFIX + 'Zadania nocna'}, '19:00', '07:00', 904)`;
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

  /** Zadania do rozliczenia wstawia baza, żeby test nie zależał od kolejności poprzednich. */
  async function seedTask(title: string, status: 'PROPOSED' | 'TODO') {
    const [admin] = await sql`SELECT id FROM auth.users WHERE email = ${TEST_USERS.org_admin.email}`;
    await sql`INSERT INTO public.shift_tasks (organization_id, shift_definition_id, shift_date, title, source, status, created_by)
      SELECT ${orgId}, id, ${SETTLE_DATE}, ${title}, 'MANUAL', ${status}, ${admin.id} FROM public.shift_definitions
      WHERE organization_id = ${orgId} AND code = ${CODE}`;
  }

  test('@REQ: NUR-TASKS - kierownik zatwierdza propozycję i oznacza zadanie jako wykonane', async ({ loginPage, page }) => {
    await seedTask('E2E Propozycja do zatwierdzenia', 'PROPOSED');
    await loginPage.loginAs('org_admin');
    const tasks = new ShiftTasksPage(page);
    await tasks.goto(CODE, SETTLE_DATE);

    await expect(tasks.task('E2E Propozycja do zatwierdzenia')).toContainText('Propozycja');
    await tasks.approveProposal('E2E Propozycja do zatwierdzenia');
    await expect(tasks.task('E2E Propozycja do zatwierdzenia')).toContainText('Do zrobienia');
    await tasks.markDone('E2E Propozycja do zatwierdzenia');
    await expect(tasks.task('E2E Propozycja do zatwierdzenia')).toContainText('Wykonane');
  });

  test('@REQ: NUR-TASKS - anulowanie wymaga powodu i pokazuje go przy zadaniu', async ({ loginPage, page }) => {
    await seedTask('E2E Zadanie do anulowania', 'TODO');
    await loginPage.loginAs('org_admin');
    const tasks = new ShiftTasksPage(page);
    await tasks.goto(CODE, SETTLE_DATE);

    await tasks.cancel('E2E Zadanie do anulowania', '');
    await expect(tasks.task('E2E Zadanie do anulowania').getByRole('alert')).toContainText('Podaj powód anulowania.');
    await tasks.cancel('E2E Zadanie do anulowania', 'Podopieczny odmówił');
    await expect(tasks.task('E2E Zadanie do anulowania')).toContainText('Anulowane');
    await expect(tasks.task('E2E Zadanie do anulowania')).toContainText('Powód: Podopieczny odmówił');
  });

  test('@REQ: NUR-TASKS - przeniesione zadanie znika ze zmiany źródłowej i wraca na docelowej z oznaczeniem', async ({ loginPage, page }) => {
    await seedTask('E2E Zadanie do przeniesienia', 'TODO');
    await loginPage.loginAs('org_admin');
    const tasks = new ShiftTasksPage(page);
    await tasks.goto(CODE, SETTLE_DATE);

    await tasks.carry('E2E Zadanie do przeniesienia', PREFIX + 'Zadania nocna', SETTLE_DATE);
    await expect(tasks.task('E2E Zadanie do przeniesienia')).toHaveCount(0);

    await tasks.goto(CODE_2, SETTLE_DATE);
    await expect(tasks.task('E2E Zadanie do przeniesienia')).toContainText('Przeniesione z poprzedniej zmiany');
  });

  test('@REQ: NUR-SHIFT-PLAN-PRINT - kierownik zatwierdza plan zmiany; każde zatwierdzenie podnosi wersję', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const tasks = new ShiftTasksPage(page);
    await tasks.goto(CODE, SETTLE_DATE);

    await expect(tasks.planStatus).toContainText('Plan nie został zatwierdzony');
    await tasks.approvePlanButton.click();
    await expect(tasks.planStatus).toContainText('Plan zatwierdzony, wersja 1');
    await tasks.approvePlanButton.click();
    await expect(tasks.planStatus).toContainText('Plan zatwierdzony, wersja 2');
  });

  test('@REQ: NUR-TASKS - personel bez roli kierownika zmiany nie ma przycisków rozliczenia ani zatwierdzenia planu', async ({ loginPage, page }) => {
    await seedTask('E2E Zadanie widoczne dla personelu', 'TODO');
    await loginPage.loginAs('nurse');
    const tasks = new ShiftTasksPage(page);
    await tasks.goto(CODE, SETTLE_DATE);

    await expect(tasks.task('E2E Zadanie widoczne dla personelu')).toBeVisible();
    await expect(tasks.task('E2E Zadanie widoczne dla personelu').getByRole('button')).toHaveCount(0);
    await expect(tasks.approvePlanButton).toHaveCount(0);
  });

  test('@REQ: NUR-SHIFT-PLAN-PRINT - wydruk planu wymaga akceptacji, pokazuje tylko zadania do zrobienia i zostawia ślad w audycie', async ({ loginPage, page }) => {
    await seedTask('E2E Zadanie na wydruk', 'TODO');
    await seedTask('E2E Propozycja poza wydrukiem', 'PROPOSED');
    await sql`DELETE FROM public.shift_plan_approvals WHERE organization_id = ${orgId} AND shift_date = ${PRINT_DATE}`;
    await loginPage.loginAs('org_admin');
    await page.addInitScript(() => { (window as unknown as { __printed: number }).__printed = 0; window.print = () => { (window as unknown as { __printed: number }).__printed++; }; });
    const tasks = new ShiftTasksPage(page);

    await page.goto(`/staff/shift-plan/print?shift=${CODE}&date=${SETTLE_DATE}`);
    await expect(page.getByText('Najpierw zatwierdź plan zmiany')).toBeVisible();

    await tasks.goto(CODE, SETTLE_DATE);
    await tasks.approvePlanButton.click();
    await expect(tasks.planStatus).toContainText('Plan zatwierdzony');
    await tasks.printLink.click();

    await expect(page).toHaveURL(/shift-plan\/print/);
    await expect(page.getByText('E2E Zadanie na wydruk')).toBeVisible();
    await expect(page.getByText('E2E Propozycja poza wydrukiem')).toHaveCount(0);
    await tasks.printButton.click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
    const [row] = await sql`SELECT count(*)::int AS n FROM public.audit_logs WHERE organization_id = ${orgId} AND action = 'SHIFT_PLAN_PRINTED'`;
    expect(row.n).toBeGreaterThan(0);
  });
});
