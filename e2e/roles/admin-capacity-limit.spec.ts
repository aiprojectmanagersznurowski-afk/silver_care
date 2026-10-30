import postgres from 'postgres';
import { test, expect } from '../fixtures/base-test';
import { FacilityPage } from '../page-objects/FacilityPage';
import { TEST_USERS } from '../fixtures/test-users';

/**
 * @REQ: ADM-CAPACITY-LIMIT
 *
 * SC-ADM-22, przypadek 1: kierownik dodaje łóżko ponad limit miejsc — widzi ostrzeżenie z liczbami,
 * bez potwierdzenia nic nie jest zapisywane, po potwierdzeniu łóżko powstaje i przekroczenie trafia do audytu.
 * Limit placówki kierownika testowego ustawiany bezpośrednio w bazie (bez JWT) na liczbę jej aktywnych łóżek
 * i przywracany po teście. Placówka z app_metadata konta — nie ze stałej, bo konto może należeć do innej placówki.
 */
const BED_LABEL = 'E2E-LIMIT';
const IMPORT_ROOM = 'E2E-LIM-R';
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

test.describe('Limit miejsc przy dodawaniu łóżka (@REQ: ADM-CAPACITY-LIMIT)', () => {
  test.describe.configure({ mode: 'serial' });
  let sql: postgres.Sql;
  let previousLimit: number | null = null;
  let MAIN_ORG_ID = '';

  test.beforeAll(async () => {
    sql = postgres(dbUrl!, { prepare: false });
    const [admin] = await sql`SELECT raw_app_meta_data->>'organization_id' AS org FROM auth.users WHERE email = ${TEST_USERS.org_admin.email}`;
    MAIN_ORG_ID = admin.org;
    await sql`DELETE FROM public.beds b USING public.rooms r WHERE b.room_id = r.id AND r.organization_id = ${MAIN_ORG_ID} AND b.label = ${BED_LABEL}`;
    const [org] = await sql`SELECT resident_limit FROM public.organizations WHERE id = ${MAIN_ORG_ID}`;
    previousLimit = org.resident_limit;
    const [beds] = await sql`
      SELECT count(*)::int AS n FROM public.beds b JOIN public.rooms r ON r.id = b.room_id
      WHERE r.organization_id = ${MAIN_ORG_ID} AND b.is_active`;
    await sql`UPDATE public.organizations SET resident_limit = ${beds.n} WHERE id = ${MAIN_ORG_ID}`;
  });

  async function removeImportedRoom() {
    await sql`DELETE FROM public.beds b USING public.rooms r WHERE b.room_id = r.id AND r.organization_id = ${MAIN_ORG_ID} AND r.number = ${IMPORT_ROOM}`;
    await sql`DELETE FROM public.rooms WHERE organization_id = ${MAIN_ORG_ID} AND number = ${IMPORT_ROOM}`;
  }

  test.afterAll(async () => {
    await removeImportedRoom();
    await sql`DELETE FROM public.beds b USING public.rooms r WHERE b.room_id = r.id AND r.organization_id = ${MAIN_ORG_ID} AND b.label = ${BED_LABEL}`;
    await sql`UPDATE public.organizations SET resident_limit = ${previousLimit} WHERE id = ${MAIN_ORG_ID}`;
    await sql.end();
  });

  test('@REQ: ADM-CAPACITY-LIMIT - ostrzeżenie przed zapisem, łóżko dopiero po potwierdzeniu, wpis w audycie', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const facility = new FacilityPage(page);
    await facility.goto();

    await facility.startAddingBed(BED_LABEL);
    await expect(facility.capacityWarning).toBeVisible();
    await expect(facility.capacityWarning).toContainText('przy limicie miejsc');

    const [before] = await sql`
      SELECT count(*)::int AS n FROM public.beds b JOIN public.rooms r ON r.id = b.room_id
      WHERE r.organization_id = ${MAIN_ORG_ID} AND b.label = ${BED_LABEL}`;
    expect(before.n).toBe(0);

    await facility.confirmCapacityButton.click();
    await expect(facility.capacityWarning).toBeHidden();

    await expect.poll(async () => {
      const [after] = await sql`
        SELECT count(*)::int AS n FROM public.beds b JOIN public.rooms r ON r.id = b.room_id
        WHERE r.organization_id = ${MAIN_ORG_ID} AND b.label = ${BED_LABEL}`;
      return after.n;
    }).toBe(1);

    const [audit] = await sql`
      SELECT payload FROM public.audit_logs
      WHERE organization_id = ${MAIN_ORG_ID} AND action = 'ORGANIZATION_CAPACITY_EXCEEDED'
      ORDER BY created_at DESC LIMIT 1`;
    expect(audit.payload).toMatchObject({ operation: 'bed_create', counts: 'beds', excess: 1 });
  });

  test('@REQ: ADM-CAPACITY-LIMIT - import struktury ponad limit: ostrzeżenie w podglądzie, zapis dopiero po potwierdzeniu', async ({ loginPage, page }) => {
    await removeImportedRoom();
    const [beds] = await sql`
      SELECT count(*)::int AS n FROM public.beds b JOIN public.rooms r ON r.id = b.room_id
      WHERE r.organization_id = ${MAIN_ORG_ID} AND b.is_active`;
    await sql`UPDATE public.organizations SET resident_limit = ${beds.n} WHERE id = ${MAIN_ORG_ID}`;

    await loginPage.loginAs('org_admin');
    const facility = new FacilityPage(page);
    await facility.goto();
    await facility.uploadFacilityCsv('struktura.csv', `Piętro,Pokój,Sektor,Liczba łóżek,Etykiety\n9,${IMPORT_ROOM},,2,"A,B"\n`);

    await expect(facility.capacityWarning).toBeVisible();
    await expect(facility.capacityWarning).toContainText('przy limicie miejsc');
    await expect(facility.capacityWarning).toContainText('o 2 więcej');

    const roomCount = async () => {
      const [r] = await sql`SELECT count(*)::int AS n FROM public.rooms WHERE organization_id = ${MAIN_ORG_ID} AND number = ${IMPORT_ROOM}`;
      return r.n;
    };

    // Bez potwierdzenia nic nie jest zapisywane
    await facility.commitImportButton.click();
    await page.waitForTimeout(1500);
    expect(await roomCount()).toBe(0);

    await facility.confirmImportCapacityCheckbox.check();
    await facility.commitImportButton.click();
    await expect.poll(roomCount).toBe(1);

    const [audit] = await sql`
      SELECT payload FROM public.audit_logs
      WHERE organization_id = ${MAIN_ORG_ID} AND action = 'ORGANIZATION_CAPACITY_EXCEEDED'
      ORDER BY created_at DESC LIMIT 1`;
    expect(audit.payload).toMatchObject({ operation: 'bed_create', counts: 'beds', excess: 2 });
  });
});
