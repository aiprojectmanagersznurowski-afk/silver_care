import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

/**
 * @REQ: SUP-IAM-PANEL
 * @REQ: ORG-ISOLATION
 *
 * Dawne role (admin, facility_manager, caregiver, paramedic) usunięte 2026-10-26 (decyzja Michała).
 * Polityki i funkcje bazy nie mogą ich wpuszczać, a rola i placówka liczą się wyłącznie z app_metadata
 * (user_metadata użytkownik edytuje sam). Każdy test działa w transakcji i kończy się ROLLBACK.
 */

type Tx = postgres.TransactionSql;

const claims = (role: string, orgId?: string) =>
  JSON.stringify({ sub: '00000000-0000-0000-0000-0000000000a1', app_metadata: { role, ...(orgId ? { organization_id: orgId } : {}) }, aal: 'aal2' });

async function asRole(tx: Tx, role: string, orgId?: string) {
  await tx`SELECT set_config('request.jwt.claims', ${claims(role, orgId)}, true)`;
}

async function seed(tx: Tx) {
  await tx`SET LOCAL ROLE authenticated`;
  await asRole(tx, 'super_admin');
  const [org] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Dawne Role') RETURNING id`;
  const orgId = org.id as string;
  await asRole(tx, 'org_admin', orgId);
  const [res] = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Testowy', 'hash-legacy-1') RETURNING id`;
  const [pkg] = await tx`INSERT INTO resident_packages (organization_id, resident_id, package_type, package_name) VALUES (${orgId}, ${res.id}, 'other', 'Pakiet') RETURNING id`;
  return { orgId, residentId: res.id as string, packageId: pkg.id as string };
}

async function rollback(fn: (tx: Tx) => Promise<void>) {
  await sql.begin(async (tx) => {
    await fn(tx);
    throw new Error('ROLLBACK');
  }).catch((e) => {
    if (e.message !== 'ROLLBACK') throw e;
  });
}

/** Wykonuje zapytanie w savepoincie; zwraca komunikat błędu albo 'ok'. */
async function attempt(tx: Tx, fn: (sp: Tx) => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint((sp) => fn(sp as unknown as Tx));
    return 'ok';
  } catch (e) {
    return (e as Error).message;
  }
}

describe('Baza bez dawnych ról (SUP-IAM-PANEL)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('@REQ: ORG-ISOLATION - facility_manager nie zapisuje zdarzeń pobytu, pakietów ani historii poziomu opieki; org_admin tak', async () => {
    await rollback(async (tx) => {
      const { orgId, residentId, packageId } = await seed(tx);

      await asRole(tx, 'facility_manager', orgId);
      expect(await attempt(tx, (sp) => sp`INSERT INTO resident_events (organization_id, resident_id, event_type) VALUES (${orgId}, ${residentId}, 'admission')`)).toMatch(/row-level security/);
      expect(await attempt(tx, (sp) => sp`INSERT INTO resident_packages (organization_id, resident_id, package_type, package_name) VALUES (${orgId}, ${residentId}, 'other', 'X')`)).toMatch(/row-level security/);
      expect(await attempt(tx, (sp) => sp`INSERT INTO resident_care_level_history (resident_id, care_level) VALUES (${residentId}, 'walking')`)).toMatch(/row-level security/);
      const updated = await tx`UPDATE resident_packages SET package_name = 'Zmieniony' WHERE id = ${packageId} RETURNING id`;
      expect(updated).toHaveLength(0);

      await asRole(tx, 'org_admin', orgId);
      expect(await attempt(tx, (sp) => sp`INSERT INTO resident_events (organization_id, resident_id, event_type) VALUES (${orgId}, ${residentId}, 'admission')`)).toBe('ok');
      expect(await attempt(tx, (sp) => sp`INSERT INTO resident_care_level_history (resident_id, care_level) VALUES (${residentId}, 'walking')`)).toBe('ok');
    });
  }, 20000);

  it('@REQ: SUP-IAM-PANEL - rola admin nie rejestruje działań na personelu ani nie przyjmuje podopiecznych', async () => {
    await rollback(async (tx) => {
      const { orgId } = await seed(tx);
      const [other] = await tx`SELECT gen_random_uuid() AS id`;

      await asRole(tx, 'admin', orgId);
      expect(await attempt(tx, (sp) => sp`SELECT public.log_staff_management_action(${other.id}, 'deactivate', ${orgId})`)).toMatch(/Only org_admin/);
      expect(await attempt(tx, (sp) => sp`SELECT public.admit_resident_with_bed('Anna', 'Nowa', 'hash-legacy-2', 'female', '1940-01-01', 'walking')`)).toMatch(/Only org_admin/);
    });
  }, 20000);

  it('@REQ: SUP-IAM-PANEL - podsumowanie placówek liczy personel tylko z app_metadata', async () => {
    await rollback(async (tx) => {
      const [org] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Liczenie') RETURNING id`;
      await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data, raw_user_meta_data)
        VALUES (gen_random_uuid(), 'authenticated', 'authenticated', '{}'::jsonb, ${tx.json({ role: 'nurse', organization_id: org.id })})`;

      await tx`SET LOCAL ROLE authenticated`;
      await asRole(tx, 'super_admin');
      const [row] = await tx`SELECT staff_count FROM public.get_superadmin_organization_summary() WHERE organization_id = ${org.id}`;
      expect(Number(row.staff_count)).toBe(0);
    });
  }, 20000);

  it('@REQ: SUP-IAM-PANEL - żadne konto nie ma roli ani placówki w user_metadata', async () => {
    const [row] = await sql`SELECT count(*)::int AS n FROM auth.users WHERE raw_user_meta_data ? 'role' OR raw_user_meta_data ? 'organization_id'`;
    expect(row.n).toBe(0);
  }, 20000);
});
