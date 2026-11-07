import postgres from 'postgres';
import { test, expect } from '../fixtures/base-test';
import { ResidentProfilePage } from '../page-objects/ResidentProfilePage';
import { ShiftTasksPage } from '../page-objects/ShiftTasksPage';
import { TEST_USERS } from '../fixtures/test-users';

/**
 * @REQ: ADM-RESIDENT-CARD-TASKS
 *
 * SC-ADM-21 (AC1, AC5, AC6): sekcja „Zadania” na karcie podopiecznego — otwarte zadania z terminem, źródłem
 * i przypisaniem, wykonane z ostatnich 7 dni, „Dodaj zadanie” z kontekstem podopiecznego. Znacznik „Wymaga uwagi”
 * przy otwartym zadaniu do zrobienia gaśnie po rozliczeniu. Bliscy nie widzą zadań.
 * Test tworzy własną zmianę „E2E Karta …” i zadania z prefiksem „E2E Karta”, kasowane po teście. Zmiana i podopieczny
 * są osobne dla każdego projektu (przeglądarki), bo projekty biegną równolegle na tej samej bazie.
 */
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const DATE = '2026-11-12';
const PROJECTS = ['chromium', 'mobile-chrome', 'mobile-safari'];
const T = {
  todo: 'E2E Karta zmierzyć płyny',
  proposed: 'E2E Karta propozycja spaceru',
  done: 'E2E Karta wykonane wczoraj',
  old: 'E2E Karta wykonane dawno',
  cancelled: 'E2E Karta anulowane',
};

test.describe('Karta podopiecznego — zadania (@REQ: ADM-RESIDENT-CARD-TASKS)', () => {
  test.describe.configure({ mode: 'serial' });
  let sql: postgres.Sql;
  let orgId = '';
  let residentId = '';
  let CODE = '';
  let SHIFT_NAME = '';

  test.beforeAll(async ({}, testInfo) => {
    const project = Math.max(0, PROJECTS.indexOf(testInfo.project.name));
    CODE = `E2E-KARTA-${project}`;
    SHIFT_NAME = `E2E Karta ${project}`;
    sql = postgres(dbUrl!, { prepare: false });
    const [admin] = await sql`SELECT id, raw_app_meta_data->>'organization_id' AS org FROM auth.users WHERE email = ${TEST_USERS.org_admin.email}`;
    orgId = admin.org;
    // Pozostałości po przerwanym przebiegu (zadania kasują się kaskadowo z definicją zmiany)
    await sql`DELETE FROM public.shift_definitions WHERE organization_id = ${orgId} AND code = ${CODE}`;
    // Podopieczny bez innych otwartych zadań (znacznik zależy tylko od tego testu), inny dla każdego projektu.
    // Na początku listy ten powiązany z kontem bliskiego testowego, żeby sprawdzić też portal bliskich.
    const [r] = await sql`SELECT r.id::text AS id FROM public.residents r
      WHERE r.organization_id = ${orgId} AND r.archived_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.shift_tasks t WHERE t.resident_id = r.id AND t.status IN ('TODO', 'PROPOSED'))
      ORDER BY EXISTS (SELECT 1 FROM public.resident_relative_links rrl JOIN auth.users u ON u.id = rrl.relative_user_id
          WHERE rrl.resident_id = r.id AND u.email = ${TEST_USERS.family.email}) DESC, r.last_name, r.id
      OFFSET ${project} LIMIT 1`;
    residentId = r.id;

    const [shift] = await sql`INSERT INTO public.shift_definitions (organization_id, code, name, start_time, end_time, order_index)
      VALUES (${orgId}, ${CODE}, ${SHIFT_NAME}, '07:00', '19:00', 905) RETURNING id`;
    const base = { organization_id: orgId, shift_definition_id: shift.id, shift_date: DATE, resident_id: residentId, source: 'MANUAL', created_by: admin.id };
    await sql`INSERT INTO public.shift_tasks ${sql([
      { ...base, title: T.todo, due_time: '10:00', status: 'TODO', settled_by: null, settled_at: null, cancel_reason: null },
      { ...base, title: T.proposed, due_time: null, status: 'PROPOSED', settled_by: null, settled_at: null, cancel_reason: null },
      { ...base, title: T.done, due_time: null, status: 'DONE', settled_by: admin.id, settled_at: new Date(Date.now() - 86_400_000), cancel_reason: null },
      { ...base, title: T.old, due_time: null, status: 'DONE', settled_by: admin.id, settled_at: new Date(Date.now() - 10 * 86_400_000), cancel_reason: null },
      { ...base, title: T.cancelled, due_time: null, status: 'CANCELLED', settled_by: admin.id, settled_at: new Date(), cancel_reason: 'E2E powód' },
    ])}`;
  });

  test.afterAll(async () => {
    await sql`DELETE FROM public.shift_definitions WHERE organization_id = ${orgId} AND code = ${CODE}`;
    await sql.end();
  });

  test('@REQ: ADM-RESIDENT-CARD-TASKS - kierownik placówki widzi otwarte i niedawno wykonane zadania z terminem, źródłem i przypisaniem', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const card = new ResidentProfilePage(page);
    await card.openAdminCard(residentId);
    await card.tab('Zadania').click();

    const todo = card.taskItem('open', T.todo);
    await expect(todo).toContainText('Do zrobienia');
    await expect(todo).toContainText('Ręczne');
    await expect(todo).toContainText('Cała zmiana');
    await expect(todo).toContainText(SHIFT_NAME);
    await expect(todo).toContainText('10:00');
    await expect(card.taskItem('open', T.proposed)).toContainText('Propozycja');

    await expect(card.taskItem('done', T.done)).toBeVisible();
    await expect(page.locator('main').getByText(T.old)).toHaveCount(0);
    await expect(page.locator('main').getByText(T.cancelled)).toHaveCount(0);
  });

  test('@REQ: ADM-RESIDENT-CARD-TASKS - „Dodaj zadanie” otwiera listę zadań z wybranym tym podopiecznym', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const card = new ResidentProfilePage(page);
    await card.openAdminCard(residentId);
    await card.tab('Zadania').click();
    await card.addTaskLink.click();

    const tasks = new ShiftTasksPage(page);
    await expect(tasks.heading).toBeVisible();
    await expect(tasks.residentSelect).toHaveValue(residentId);
  });

  test('@REQ: ADM-RESIDENT-CARD-TASKS - „Wymaga uwagi” przy zadaniu do zrobienia, gaśnie po rozliczeniu mimo otwartej propozycji', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const card = new ResidentProfilePage(page);
    await card.openAdminCard(residentId);
    await expect(card.attentionBadge).toHaveText('Wymaga uwagi');

    const tasks = new ShiftTasksPage(page);
    await tasks.goto(CODE, DATE);
    await tasks.approvePlanButton.click();
    await expect(tasks.planStatus).toContainText('Plan zatwierdzony');
    await tasks.markDone(T.todo);
    // Przycisk „Wykonane: …” znika dopiero po zapisie rozliczenia — sam napis „Wykonane” jest na przycisku od początku
    await expect(tasks.task(T.todo).getByRole('button', { name: /^Wykonane:/ })).toHaveCount(0);
    await expect(tasks.task(T.todo)).toContainText('Wykonane');

    await card.openAdminCard(residentId);
    await expect(card.attentionBadge).toHaveCount(0);
    await card.tab('Zadania').click();
    await expect(card.taskItem('done', T.todo)).toBeVisible();
    await expect(card.taskItem('open', T.proposed)).toBeVisible();
  });

  test('@REQ: ADM-RESIDENT-CARD-TASKS - personel opiekuńczy widzi sekcję „Zadania” na karcie', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    const card = new ResidentProfilePage(page);
    await card.openStaffCard(residentId);
    await card.tab('Zadania').click();
    await expect(card.taskItem('open', T.proposed)).toBeVisible();
  });

  test('@REQ: ADM-RESIDENT-CARD-TASKS - bliski nie widzi zadań podopiecznego w portalu', async ({ loginPage, page }) => {
    await loginPage.loginAs('family');
    for (const path of ['/dashboard', '/agenda']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/E2E Karta/)).toHaveCount(0);
    }
  });
});
