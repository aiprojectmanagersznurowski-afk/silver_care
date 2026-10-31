import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

/**
 * @REQ: NUR-TASKS
 * @REQ: NUR-SHIFT-PLAN-PRINT
 *
 * Zadania zmiany i akceptacja planu (SC-NUR-13/15/16): personel dodaje zadania ręczne jako propozycje,
 * status zmienia tylko kierownik zmiany (na swojej zmianie i dniu) albo kierownik placówki; anulowanie wymaga powodu;
 * przeniesienie tworzy nowe zadanie; rodzina nie ma dostępu; audyt bez treści zadania. Każdy test w transakcji z ROLLBACK.
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
const NEXT_DAY = '2026-11-04';
const SECRET_TITLE = 'Podać herbatę pani Kowalskiej';

async function seed(tx: Tx) {
  const [org] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Zadania Test') RETURNING id`;
  const [otherOrg] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Zadania Inna') RETURNING id`;
  const mkUser = async (role: string, orgId: string) => {
    const [u] = await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data, raw_user_meta_data)
      VALUES (gen_random_uuid(), 'authenticated', 'authenticated', ${tx.json({ role, organization_id: orgId })}, '{}'::jsonb) RETURNING id`;
    return u.id as string;
  };
  const admin = await mkUser('org_admin', org.id);
  const lead = await mkUser('nurse', org.id);
  const nurse = await mkUser('nurse', org.id);
  const foreignAdmin = await mkUser('org_admin', otherOrg.id);
  const [resident] = await tx`INSERT INTO residents (organization_id, first_name, last_name) VALUES (${org.id}, 'Test', 'Zadania') RETURNING id`;
  await tx`SET LOCAL ROLE authenticated`;
  await as(tx, 'org_admin', org.id, admin);
  const [day] = await tx`INSERT INTO shift_definitions (organization_id, code, name, start_time, end_time) VALUES (${org.id}, 'DAY', 'Dzienna', '07:00', '19:00') RETURNING id`;
  const [night] = await tx`INSERT INTO shift_definitions (organization_id, code, name, start_time, end_time) VALUES (${org.id}, 'NIGHT', 'Nocna', '19:00', '07:00') RETURNING id`;
  await tx`INSERT INTO shift_roster (organization_id, shift_definition_id, shift_date, user_id, is_shift_lead) VALUES (${org.id}, ${day.id}, ${DAY}, ${lead}, true)`;
  await tx`INSERT INTO shift_roster (organization_id, shift_definition_id, shift_date, user_id, is_shift_lead) VALUES (${org.id}, ${day.id}, ${DAY}, ${nurse}, false)`;
  const s = { orgId: org.id as string, otherOrgId: otherOrg.id as string, admin, lead, nurse, foreignAdmin, residentId: resident.id as string, dayId: day.id as string, nightId: night.id as string };
  return s;
}
type Seed = Awaited<ReturnType<typeof seed>>;

/** Zadanie ręczne dodane przez personel: propozycja, bez wyboru źródła i statusu. */
const addManual = (tx: Tx, s: Seed, by: string, extra: Record<string, unknown> = {}) =>
  tx`INSERT INTO shift_tasks ${tx({
    organization_id: s.orgId, shift_definition_id: s.dayId, shift_date: DAY, resident_id: s.residentId,
    title: SECRET_TITLE, source: 'MANUAL', status: 'PROPOSED', created_by: by, ...extra,
  })} RETURNING id`;

async function taskIn(tx: Tx, s: Seed, status: string) {
  await as(tx, 'org_admin', s.orgId, s.admin);
  const [t] = await tx`INSERT INTO shift_tasks ${tx({
    organization_id: s.orgId, shift_definition_id: s.dayId, shift_date: DAY, resident_id: s.residentId,
    title: SECRET_TITLE, source: 'MANUAL', status, created_by: s.admin,
  })} RETURNING id`;
  return t.id as string;
}

describe('Zadania zmiany i akceptacja planu (NUR-TASKS, NUR-SHIFT-PLAN-PRINT)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('@REQ: NUR-TASKS - personel dodaje tylko ręczne propozycje; zadanie z innym źródłem albo statusem jest odrzucone', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await as(tx, 'nurse', s.orgId, s.nurse);
      const [t] = await addManual(tx, s, s.nurse);
      expect(t.id).toBeTruthy();
      await failsWith(tx, /row-level security|violates/i, (sp) => addManual(sp, s, s.nurse, { status: 'TODO' }));
      await failsWith(tx, /row-level security|violates/i, (sp) => addManual(sp, s, s.nurse, { source: 'HANDOVER' }));
      await failsWith(tx, /row-level security|violates/i, (sp) => addManual(sp, s, s.lead)); // cudzy created_by
    });
  }, 30000);

  it('@REQ: NUR-TASKS - zwykła pielęgniarka nie zmienia statusu; kierownik zmiany zmienia tylko na swojej zmianie i dniu', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      const id = await taskIn(tx, s, 'TODO');

      await as(tx, 'nurse', s.orgId, s.nurse);
      expect((await tx`UPDATE shift_tasks SET status = 'DONE' WHERE id = ${id} RETURNING id`).length).toBe(0);

      await as(tx, 'nurse', s.orgId, s.lead);
      expect((await tx`UPDATE shift_tasks SET status = 'DONE' WHERE id = ${id} RETURNING id`).length).toBe(1);

      // zadanie na innej zmianie tego samego dnia: ten sam kierownik już nie ma uprawnień
      await as(tx, 'org_admin', s.orgId, s.admin);
      const [other] = await tx`INSERT INTO shift_tasks ${tx({
        organization_id: s.orgId, shift_definition_id: s.nightId, shift_date: DAY, title: 'Obchód nocny', source: 'MANUAL', status: 'TODO', created_by: s.admin,
      })} RETURNING id`;
      await as(tx, 'nurse', s.orgId, s.lead);
      expect((await tx`UPDATE shift_tasks SET status = 'DONE' WHERE id = ${other.id} RETURNING id`).length).toBe(0);
    });
  }, 30000);

  it('@REQ: NUR-TASKS - anulowanie bez powodu jest odrzucone; rozliczenie zapisuje, kto i kiedy', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      const id = await taskIn(tx, s, 'TODO');
      await as(tx, 'nurse', s.orgId, s.lead);
      await failsWith(tx, /cancel_reason|chk_shift_tasks/i, (sp) => sp`UPDATE shift_tasks SET status = 'CANCELLED' WHERE id = ${id}`);
      await tx`UPDATE shift_tasks SET status = 'CANCELLED', cancel_reason = 'Podopieczny odmówił' WHERE id = ${id}`;
      const [row] = await tx`SELECT settled_by, settled_at FROM shift_tasks WHERE id = ${id}`;
      expect(row.settled_by).toBe(s.lead);
      expect(row.settled_at).not.toBeNull();
    });
  }, 30000);

  it('@REQ: NUR-TASKS - zmiana statusu trafia do audytu bez treści zadania', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      const id = await taskIn(tx, s, 'TODO');
      await as(tx, 'nurse', s.orgId, s.lead);
      await tx`UPDATE shift_tasks SET status = 'DONE' WHERE id = ${id}`;
      await as(tx, 'org_admin', s.orgId, s.admin);
      const rows = await tx`SELECT payload FROM audit_logs WHERE action = 'SHIFT_TASK_STATUS_CHANGED' AND organization_id = ${s.orgId}`;
      expect(rows.length).toBe(1);
      expect(JSON.stringify(rows[0].payload)).not.toContain(SECRET_TITLE);
      expect(rows[0].payload).toMatchObject({ task_id: id, to: 'DONE' });
    });
  }, 30000);

  it('@REQ: NUR-TASKS - przeniesienie tworzy nowe zadanie z odniesieniem do poprzedniego; zwykła pielęgniarka nie rozlicza', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      const id = await taskIn(tx, s, 'TODO');

      await as(tx, 'nurse', s.orgId, s.nurse);
      await failsWith(tx, /SHIFT_NOT_LEAD/, (sp) => sp`SELECT public.settle_shift_task(${id}, 'DONE', NULL, NULL, NULL)`);

      await as(tx, 'nurse', s.orgId, s.lead);
      await failsWith(tx, /SHIFT_CANCEL_REASON_REQUIRED/, (sp) => sp`SELECT public.settle_shift_task(${id}, 'CANCELLED', NULL, NULL, NULL)`);
      const [{ settle_shift_task: newId }] = await tx`SELECT public.settle_shift_task(${id}, 'CARRIED', NULL, ${s.nightId}, ${DAY}::date)`;
      const [moved] = await tx`SELECT shift_definition_id, shift_date, carried_from_task_id, status, source FROM shift_tasks WHERE id = ${newId}`;
      expect(moved).toMatchObject({ shift_definition_id: s.nightId, carried_from_task_id: id, status: 'TODO', source: 'MANUAL' });
      const [old] = await tx`SELECT status FROM shift_tasks WHERE id = ${id}`;
      expect(old.status).toBe('TODO'); // historia nie ginie
    });
  }, 30000);

  it('@REQ: NUR-TASKS - rodzina, opiekun prawny i inna placówka nie widzą zadań', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await taskIn(tx, s, 'TODO');
      for (const role of ['family', 'legal_guardian']) {
        await as(tx, role, s.orgId, '00000000-0000-0000-0000-0000000000f1');
        expect((await tx`SELECT id FROM shift_tasks`).length, role).toBe(0);
        expect((await tx`SELECT id FROM shift_plan_approvals`).length, role).toBe(0);
      }
      await as(tx, 'org_admin', s.otherOrgId, s.foreignAdmin);
      expect((await tx`SELECT id FROM shift_tasks`).length).toBe(0);
      await as(tx, 'nurse', s.orgId, s.nurse);
      expect((await tx`SELECT id FROM shift_tasks`).length).toBe(1);
    });
  }, 30000);

  it('@REQ: NUR-SHIFT-PLAN-PRINT - akceptację planu tworzy kierownik zmiany albo kierownik placówki; wersje rosną i się nie powtarzają', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      const approve = (sp: Tx, by: string, version: number, date = DAY) =>
        sp`INSERT INTO shift_plan_approvals ${sp({ organization_id: s.orgId, shift_definition_id: s.dayId, shift_date: date, version, approved_by: by })}`;

      await as(tx, 'nurse', s.orgId, s.nurse);
      await failsWith(tx, /row-level security|violates/i, (sp) => approve(sp, s.nurse, 1));

      await as(tx, 'nurse', s.orgId, s.lead);
      await approve(tx, s.lead, 1);
      await failsWith(tx, /duplicate key|uq_shift_plan_approvals/i, (sp) => approve(sp, s.lead, 1));
      await failsWith(tx, /row-level security|violates/i, (sp) => approve(sp, s.lead, 1, NEXT_DAY)); // nie jego dzień

      await as(tx, 'org_admin', s.orgId, s.admin);
      await approve(tx, s.admin, 2);
      expect((await tx`SELECT version FROM shift_plan_approvals ORDER BY version`).map((r) => r.version)).toEqual([1, 2]);
    });
  }, 30000);
});
