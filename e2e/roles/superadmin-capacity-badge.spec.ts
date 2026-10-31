import postgres from 'postgres';
import { test, expect } from '../fixtures/base-test';
import { OrganizationManagementPage } from '../page-objects/OrganizationManagementPage.spec.helper';
import { TEST_USERS } from '../fixtures/test-users';

/**
 * @REQ: ADM-CAPACITY-LIMIT
 *
 * SC-ADM-22/AC5: lista placówek super admina oznacza placówkę ponad limitem miejsc plakietką „Ponad limit”
 * (ton brand, nie czerwień); placówka w limicie plakietki nie ma.
 * Limity dwóch placówek testowych ustawiane bezpośrednio w bazie (bez JWT) i przywracane po teście.
 */
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

test.describe('Plakietka „Ponad limit” u super admina (@REQ: ADM-CAPACITY-LIMIT)', () => {
  let sql: postgres.Sql;
  const saved: { id: string; name: string; limit: number }[] = [];

  test.beforeAll(async () => {
    sql = postgres(dbUrl!, { prepare: false });
    const [admin] = await sql`SELECT raw_app_meta_data->>'organization_id' AS org FROM auth.users WHERE email = ${TEST_USERS.org_admin.email}`;
    const orgs = await sql`
      SELECT o.id, o.name, o.resident_limit,
        (SELECT count(*)::int FROM public.beds b JOIN public.rooms r ON r.id = b.room_id WHERE r.organization_id = o.id AND b.is_active) AS beds
      FROM public.organizations o WHERE o.id <> ${admin.org} ORDER BY o.created_at LIMIT 1`;
    const [over] = await sql`
      SELECT o.id, o.name, o.resident_limit,
        (SELECT count(*)::int FROM public.beds b JOIN public.rooms r ON r.id = b.room_id WHERE r.organization_id = o.id AND b.is_active) AS beds
      FROM public.organizations o WHERE o.id = ${admin.org}`;
    for (const o of [over, orgs[0]]) saved.push({ id: o.id, name: o.name, limit: o.resident_limit });
    await sql`UPDATE public.organizations SET resident_limit = ${Math.max(0, over.beds - 1)} WHERE id = ${over.id}`;
    await sql`UPDATE public.organizations SET resident_limit = 100000 WHERE id = ${orgs[0].id}`;
  });

  test.afterAll(async () => {
    for (const o of saved) await sql`UPDATE public.organizations SET resident_limit = ${o.limit} WHERE id = ${o.id}`;
    await sql.end();
  });

  test('@REQ: ADM-CAPACITY-LIMIT - placówka ponad limitem ma plakietkę, placówka w limicie nie', async ({ loginPage, page }) => {
    await loginPage.loginAs('super_admin');
    const orgs = new OrganizationManagementPage(page);
    await orgs.goto();
    await orgs.expectLoaded();
    await orgs.switchToTable();

    const [over, under] = saved;
    await expect(orgs.rowFor(over.name).getByText('Ponad limit')).toBeVisible();
    await expect(orgs.rowFor(under.name).getByText('Ponad limit')).toHaveCount(0);
  });
});
