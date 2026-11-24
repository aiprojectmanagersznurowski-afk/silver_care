import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

/**
 * @REQ: NUR-SHIFT-PLAN-PRINT
 *
 * Wydruk planu pracy (SC-NUR-16): drukuje kierownik zmiany albo kierownik placówki, wyłącznie zatwierdzony i aktualny plan;
 * wydruk zostawia ślad w audycie (bez treści zadań) i znacznik printed_at. Każdy test w transakcji z ROLLBACK.
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

const DAY = '2026-11-03';
const SECRET_TITLE = 'Podać herbatę pani Kowalskiej';

async function seed(tx: Tx) {
  const [org] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Wydruk Test') RETURNING id`;
  const mkUser = async (role: string) => {
    const [u] = await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data, raw_user_meta_data)
      VALUES (gen_random_uuid(), 'authenticated', 'authenticated', ${tx.json({ role, organization_id: org.id })}, '{}'::jsonb) RETURNING id`;
    return u.id as string;
  };
  const admin = await mkUser('org_admin');
  const lead = await mkUser('nurse');
  const nurse = await mkUser('nurse');
  await tx`SET LOCAL ROLE authenticated`;
  await as(tx, 'org_admin', org.id, admin);
  const [day] = await tx`INSERT INTO shift_definitions (organization_id, code, name, start_time, end_time) VALUES (${org.id}, 'DAY', 'Dzienna', '07:00', '19:00') RETURNING id`;
  await tx`INSERT INTO shift_roster (organization_id, shift_definition_id, shift_date, user_id, is_shift_lead) VALUES (${org.id}, ${day.id}, ${DAY}, ${lead}, true)`;
  await tx`INSERT INTO shift_tasks (organization_id, shift_definition_id, shift_date, title, source, status, created_by)
    VALUES (${org.id}, ${day.id}, ${DAY}, ${SECRET_TITLE}, 'MANUAL', 'TODO', ${admin})`;
  return { orgId: org.id as string, admin, lead, nurse, dayId: day.id as string };
}
type Seed = Awaited<ReturnType<typeof seed>>;

const approve = (tx: Tx, s: Seed, by: string, version: number) =>
  tx`INSERT INTO shift_plan_approvals (organization_id, shift_definition_id, shift_date, version, approved_by, approved_at)
     VALUES (${s.orgId}, ${s.dayId}, ${DAY}, ${version}, ${by}, now() + interval '1 second' * ${version * 10})`;

const record = (tx: Tx, s: Seed, version = 1) =>
  tx`SELECT public.record_shift_plan_print(${s.dayId}, ${DAY}::date, ${version}) AS version`;

describe('Wydruk planu pracy (NUR-SHIFT-PLAN-PRINT)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('@REQ: NUR-SHIFT-PLAN-PRINT - wydruk bez zatwierdzonego planu jest odrzucony', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await as(tx, 'nurse', s.orgId, s.lead);
      await failsWith(tx, /SHIFT_PLAN_NOT_APPROVED/, (sp) => record(sp, s));
    });
  }, 30000);

  it('@REQ: NUR-SHIFT-PLAN-PRINT - kierownik zmiany drukuje zatwierdzony plan; ślad w audycie nie zawiera treści zadań', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await as(tx, 'nurse', s.orgId, s.lead);
      await approve(tx, s, s.lead, 1);
      const [{ version }] = await record(tx, s);
      expect(version).toBe(1);

      const [row] = await tx`SELECT printed_at FROM shift_plan_approvals WHERE shift_definition_id = ${s.dayId} AND version = 1`;
      expect(row.printed_at).not.toBeNull();
      await as(tx, 'org_admin', s.orgId, s.admin);
      const audit = await tx`SELECT payload FROM audit_logs WHERE action = 'SHIFT_PLAN_PRINTED' AND organization_id = ${s.orgId}`;
      expect(audit.length).toBe(1);
      expect(JSON.stringify(audit[0].payload)).not.toContain(SECRET_TITLE);
      expect(audit[0].payload).toMatchObject({ version: 1 });
    });
  }, 30000);

  it('@REQ: NUR-SHIFT-PLAN-PRINT - podgląd starszej wersji nie zapisuje wydruku żadnej wersji', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await approve(tx, s, s.admin, 1);
      await approve(tx, s, s.admin, 2);

      await failsWith(tx, /SHIFT_PLAN_VERSION_MISMATCH/, (sp) => record(sp, s, 1));
      const approvals = await tx`SELECT printed_at FROM shift_plan_approvals WHERE shift_definition_id = ${s.dayId}`;
      expect(approvals).toEqual([{ printed_at: null }, { printed_at: null }]);
      const audit = await tx`SELECT id FROM audit_logs WHERE action = 'SHIFT_PLAN_PRINTED' AND organization_id = ${s.orgId}`;
      expect(audit).toHaveLength(0);
    });
  }, 30000);

  it('@REQ: NUR-SHIFT-PLAN-PRINT - zwykła pielęgniarka nie drukuje planu', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await as(tx, 'nurse', s.orgId, s.lead);
      await approve(tx, s, s.lead, 1);
      await as(tx, 'nurse', s.orgId, s.nurse);
      await failsWith(tx, /SHIFT_NOT_LEAD/, (sp) => record(sp, s));
    });
  }, 30000);

  it('@REQ: NUR-SHIFT-PLAN-PRINT - zmiana zadań po akceptacji wymaga ponownej akceptacji', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await as(tx, 'nurse', s.orgId, s.lead);
      await approve(tx, s, s.lead, 1);
      await as(tx, 'org_admin', s.orgId, s.admin);
      await tx`INSERT INTO shift_tasks (organization_id, shift_definition_id, shift_date, title, source, status, created_by, created_at)
        VALUES (${s.orgId}, ${s.dayId}, ${DAY}, 'Nowe zadanie po akceptacji', 'MANUAL', 'TODO', ${s.admin}, now() + interval '1 hour')`;
      await as(tx, 'nurse', s.orgId, s.lead);
      await failsWith(tx, /SHIFT_PLAN_STALE/, (sp) => record(sp, s));

      await tx`INSERT INTO shift_plan_approvals (organization_id, shift_definition_id, shift_date, version, approved_by, approved_at)
        VALUES (${s.orgId}, ${s.dayId}, ${DAY}, 2, ${s.lead}, now() + interval '2 hours')`;
      const [{ version }] = await record(tx, s, 2);
      expect(version).toBe(2);
    });
  }, 30000);
  it('@REQ: NUR-SHIFT-CLOSURE - zmiana przypisania blokuje wydruk nawet w tej samej transakcji co akceptacja', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await approve(tx, s, s.admin, 1);
      await tx`UPDATE shift_tasks SET assignee_user_id = ${s.lead}
        WHERE shift_definition_id = ${s.dayId} AND shift_date = ${DAY}`;
      await failsWith(tx, /SHIFT_PLAN_STALE/, (sp) => record(sp, s));
      await approve(tx, s, s.admin, 2);
      expect(await record(tx, s, 2)).toEqual([{ version: 2 }]);
    });
  });

  it('@REQ: NUR-SHIFT-PLAN-PRINT blocks a plan after removing its assignee from the roster', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await tx`UPDATE shift_tasks SET assignee_user_id = ${s.lead} WHERE shift_definition_id = ${s.dayId}`;
      await approve(tx, s, s.admin, 1);
      await tx`DELETE FROM shift_roster WHERE shift_definition_id = ${s.dayId} AND user_id = ${s.lead}`;
      expect(await tx`SELECT * FROM public.get_shift_plan_status(${s.dayId}, ${DAY}::date)`).toEqual([{ version: 1, stale: true }]);
      await failsWith(tx, /SHIFT_PLAN_STALE/, (sp) => record(sp, s));
      await failsWith(tx, /SHIFT_PLAN_ASSIGNEE_NOT_ON_ROSTER/, (sp) => approve(sp, s, s.admin, 2));
      await tx`UPDATE shift_tasks SET assignee_user_id = NULL WHERE shift_definition_id = ${s.dayId}`;
      await approve(tx, s, s.admin, 2);
      expect(await record(tx, s, 2)).toEqual([{ version: 2 }]);
    });
  });

});
