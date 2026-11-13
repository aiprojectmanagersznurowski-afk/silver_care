import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

/**
 * @REQ: NUR-SHIFT-CONFIG
 * @REQ: NUR-SHIFT-LEAD
 *
 * Definicje zmian i grafik (SC-NUR-12/AC1, AC1a): kierownik placówki konfiguruje, personel czyta,
 * bliscy nie mają dostępu; do 3 aktywnych zmian; jeden kierownik na zmianę (definicja + data);
 * is_shift_lead() bierze tożsamość z sesji, nigdy z parametrów. Każdy test w transakcji z ROLLBACK.
 */
type Tx = postgres.TransactionSql;

async function rollback(fn: (tx: Tx) => Promise<void>) {
  await sql.begin(async (tx) => {
    await fn(tx);
    throw new Error('ROLLBACK');
  }).catch((e) => {
    if (e.message !== 'ROLLBACK') throw e;
  });
}

const as = (tx: Tx, role: string, orgId?: string, sub?: string) =>
  tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub, app_metadata: { role, organization_id: orgId }, aal: 'aal2' })}, true)`;

async function failsWith(tx: Tx, pattern: RegExp, run: (sp: Tx) => Promise<unknown>) {
  const result = await tx.savepoint(async (sp) => { await run(sp as unknown as Tx); }).then(() => 'zapisano', (e: Error) => e.message);
  expect(result).toMatch(pattern);
}

async function seed(tx: Tx) {
  const [org] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Zmiany Test') RETURNING id`;
  const [otherOrg] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Zmiany Inna') RETURNING id`;
  const mkUser = async (role: string, orgId: string) => {
    const [u] = await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data, raw_user_meta_data)
      VALUES (gen_random_uuid(), 'authenticated', 'authenticated', ${tx.json({ role, organization_id: orgId })}, '{}'::jsonb) RETURNING id`;
    return u.id as string;
  };
  const admin = await mkUser('org_admin', org.id);
  const nurseA = await mkUser('nurse', org.id);
  const nurseB = await mkUser('nurse', org.id);
  const foreignNurse = await mkUser('nurse', otherOrg.id);
  await tx`SET LOCAL ROLE authenticated`;
  await as(tx, 'org_admin', org.id, admin);
  const [day] = await tx`INSERT INTO shift_definitions (organization_id, code, name, start_time, end_time) VALUES (${org.id}, 'DAY', 'Dzienna', '07:00', '19:00') RETURNING id`;
  const [night] = await tx`INSERT INTO shift_definitions (organization_id, code, name, start_time, end_time) VALUES (${org.id}, 'NIGHT', 'Nocna', '19:00', '07:00') RETURNING id`;
  return { orgId: org.id as string, otherOrgId: otherOrg.id as string, admin, nurseA, nurseB, foreignNurse, dayId: day.id as string, nightId: night.id as string };
}

describe('Definicje zmian i grafik (NUR-SHIFT-CONFIG, NUR-SHIFT-LEAD)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('@REQ: NUR-SHIFT-CONFIG - kierownik placówki definiuje zmiany; zmiana nocna przechodzi przez północ; najwyżej 3 aktywne', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await as(tx, 'org_admin', s.orgId, s.admin);
      const rows = await tx`SELECT code, crosses_midnight FROM shift_definitions WHERE organization_id = ${s.orgId} ORDER BY code`;
      expect(rows.map((r) => [r.code, r.crosses_midnight])).toEqual([['DAY', false], ['NIGHT', true]]);

      await tx`INSERT INTO shift_definitions (organization_id, code, name, start_time, end_time) VALUES (${s.orgId}, 'EVE', 'Popołudniowa', '15:00', '23:00')`;
      await failsWith(tx, /SHIFT_DEFINITIONS_MAX_THREE/, (sp) =>
        sp`INSERT INTO shift_definitions (organization_id, code, name, start_time, end_time) VALUES (${s.orgId}, 'EXTRA', 'Czwarta', '01:00', '05:00')`);
    });
  }, 30000);

  it('@REQ: NUR-SHIFT-CONFIG - personel czyta zmiany własnej placówki, nie zmienia ich; inna placówka i bliscy nic nie widzą', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await as(tx, 'nurse', s.orgId, s.nurseA);
      expect((await tx`SELECT id FROM shift_definitions`).length).toBe(2);
      await failsWith(tx, /row-level security|violates|permission denied/i, (sp) =>
        sp`INSERT INTO shift_definitions (organization_id, code, name, start_time, end_time) VALUES (${s.orgId}, 'X', 'X', '01:00', '02:00')`);

      await as(tx, 'org_admin', s.otherOrgId, s.admin);
      expect((await tx`SELECT id FROM shift_definitions`).length).toBe(0);
      for (const role of ['family', 'legal_guardian']) {
        await as(tx, role, s.orgId, '00000000-0000-0000-0000-0000000000f1');
        expect((await tx`SELECT id FROM shift_definitions`).length, role).toBe(0);
        expect((await tx`SELECT id FROM shift_roster`).length, role).toBe(0);
      }
    });
  }, 30000);

  it('@REQ: NUR-SHIFT-LEAD - jeden kierownik zmiany na zmianę i dzień; kierownik musi być personelem opiekuńczym tej placówki', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await as(tx, 'org_admin', s.orgId, s.admin);
      const add = (sp: Tx, userId: string, lead: boolean, date = '2026-11-03') =>
        sp`INSERT INTO shift_roster (organization_id, shift_definition_id, shift_date, user_id, is_shift_lead) VALUES (${s.orgId}, ${s.dayId}, ${date}, ${userId}, ${lead})`;

      await add(tx, s.nurseA, true);
      await add(tx, s.nurseB, false);
      await failsWith(tx, /duplicate key|uq_shift_roster_single_lead/i, (sp) => sp`UPDATE shift_roster SET is_shift_lead = true WHERE user_id = ${s.nurseB}`);
      await add(tx, s.nurseB, true, '2026-11-04'); // inny dzień — może

      await failsWith(tx, /SHIFT_ROSTER_FOREIGN_USER/, (sp) => add(sp, s.foreignNurse, false, '2026-11-05'));
      await failsWith(tx, /SHIFT_LEAD_MUST_BE_NURSE/, (sp) => add(sp, s.admin, true, '2026-11-06'));
    });
  }, 30000);

  it('@REQ: NUR-SHIFT-LEAD - is_shift_lead() zależy od sesji: tylko kierownik tej zmiany i tego dnia', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await as(tx, 'org_admin', s.orgId, s.admin);
      await tx`INSERT INTO shift_roster (organization_id, shift_definition_id, shift_date, user_id, is_shift_lead) VALUES (${s.orgId}, ${s.dayId}, '2026-11-03', ${s.nurseA}, true)`;
      await tx`INSERT INTO shift_roster (organization_id, shift_definition_id, shift_date, user_id, is_shift_lead) VALUES (${s.orgId}, ${s.dayId}, '2026-11-03', ${s.nurseB}, false)`;

      const check = async (userId: string, definitionId: string, date: string) => {
        await as(tx, 'nurse', s.orgId, userId);
        const [r] = await tx`SELECT public.is_shift_lead(${definitionId}, ${date}::date) AS lead`;
        return r.lead as boolean;
      };
      expect(await check(s.nurseA, s.dayId, '2026-11-03')).toBe(true);
      expect(await check(s.nurseA, s.dayId, '2026-11-04')).toBe(false); // inny dzień
      expect(await check(s.nurseA, s.nightId, '2026-11-03')).toBe(false); // inna zmiana
      expect(await check(s.nurseB, s.dayId, '2026-11-03')).toBe(false); // w grafiku, ale nie kierownik
      expect(await check(s.foreignNurse, s.dayId, '2026-11-03')).toBe(false); // obca placówka
    });
  }, 30000);
});
