import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
const migrationSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261113090000_resident_death_report_staff_only.sql'),
  'utf8'
);

/**
 * @REQ: ADM-BED-ASSIGNMENT
 * @REQ: ADM-ARCHIVE
 * @REQ: ORG-ISOLATION
 *
 * Weryfikacja na poziomie bazy danych (RLS + RPC):
 * 1. Stan oczekującego zgłoszenia zgonu znajduje się poza tabelą residents (w resident_death_reports),
 *    dzięki czemu rola family i legal_guardian nie odczyta go przez API przed potwierdzeniem przez kierownika.
 * 2. Polityka resident_events_insert oraz RPC report_resident_death_atomic blokują zapis między placówkami.
 * 3. Atomowe anulowanie (cancel_resident_death_report_atomic) usuwa wyłącznie zadania procedury po zgonie
 *    powiązane ze zgłoszeniem, zachowując inne zadania staff_only podopiecznego oraz zapisując ślad w audycie.
 */

type Tx = postgres.TransactionSql;

const asRole = (tx: Tx, role: string, orgId: string, sub: string) =>
  tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
    sub,
    role: 'authenticated',
    app_metadata: { role, organization_id: orgId },
    aal: 'aal2',
  })}, true)`;

async function rollback(fn: (tx: Tx) => Promise<void>) {
  await sql.begin(async (tx) => {
    await tx.unsafe(migrationSql);
    await fn(tx);
    throw new Error('ROLLBACK');
  }).catch((e) => {
    if (e.message !== 'ROLLBACK') throw e;
  });
}

async function failsWith(tx: Tx, pattern: RegExp, run: (sp: Tx) => Promise<unknown>) {
  const result = await tx
    .savepoint(async (sp) => {
      await run(sp as unknown as Tx);
    })
    .then(
      () => 'wykonano',
      (e: Error) => e.message
    );
  expect(result).toMatch(pattern);
}

async function seed(tx: Tx) {
  const [orgA] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Zgon A') RETURNING id`;
  const [orgB] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Zgon B') RETURNING id`;

  const mkUser = async (role: string, orgId: string) => {
    const [u] = await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data, raw_user_meta_data)
      VALUES (gen_random_uuid(), 'authenticated', 'authenticated', ${tx.json({ role, organization_id: orgId })}, '{}'::jsonb) RETURNING id`;
    return u.id as string;
  };

  const adminA = await mkUser('org_admin', orgA.id);
  const nurseA = await mkUser('nurse', orgA.id);
  const familyA = await mkUser('family', orgA.id);
  const guardianA = await mkUser('legal_guardian', orgA.id);
  const nurseB = await mkUser('nurse', orgB.id);

  const [resA] = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash)
    VALUES (${orgA.id}, 'Maria', 'Testowa', 'hash-death-a') RETURNING id`;
  const [resB] = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash)
    VALUES (${orgB.id}, 'Piotr', 'Obcy', 'hash-death-b') RETURNING id`;

  await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role) VALUES
    (${resA.id}, ${familyA}, 'SON', 'family'),
    (${resA.id}, ${guardianA}, 'GUARDIAN', 'legal_guardian')`;

  // Istniejące wcześniej zadanie staff_only podopiecznego (niezwiązane ze zgłoszeniem zgonu)
  const [existingStaffTask] = await tx`INSERT INTO agenda_items (organization_id, resident_id, target_date, time, type, title, family_visible)
    VALUES (${orgA.id}, ${resA.id}, '2026-10-15', '12:00', 'staff_only', 'Inwentaryzacja szafki nocnej', false) RETURNING id`;

  await tx`SET LOCAL ROLE authenticated`;

  return {
    orgA: orgA.id as string,
    orgB: orgB.id as string,
    adminA,
    nurseA,
    familyA,
    guardianA,
    nurseB,
    resA: resA.id as string,
    resB: resB.id as string,
    existingStaffTaskId: existingStaffTask.id as string,
  };
}

describe('Zgłoszenie zgonu przez personel — izolacja od rodziny, blokada cross-tenant i atomowe anulowanie (@REQ: ADM-BED-ASSIGNMENT, @REQ: ADM-ARCHIVE, @REQ: ORG-ISOLATION)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('@REQ: ADM-BED-ASSIGNMENT - family i legal_guardian nie odczytają oczekującego zgłoszenia zgonu ani z residents, ani z resident_death_reports', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);

      // Kolumna death_reported_at nie istnieje na tabeli residents
      const cols = await tx`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'residents' AND column_name = 'death_reported_at'
      `;
      expect(cols).toHaveLength(0);

      // Pielęgniarka zgłasza zgon atomowo przez RPC
      await asRole(tx, 'nurse', s.orgA, s.nurseA);
      const tasksJson = JSON.stringify([
        { target_date: '2026-10-28', time: '08:00', title: 'Procedura po zgonie: wezwanie lekarza do stwierdzenia zgonu i karty zgonu' },
        { target_date: '2026-10-28', time: '09:00', title: 'Procedura po zgonie: zabezpieczenie i spis depozytu rzeczy osobistych' },
        { target_date: '2026-10-28', time: '10:00', title: 'Sanityzacja i dezynfekcja miejsca (Pokój 101, Łóżko 1)' },
      ]);
      await tx`SELECT public.report_resident_death_atomic(${s.resA}::uuid, '2026-10-28'::date, 'Zgłoszenie nocne', ${tasksJson}::jsonb)`;

      // Personel (nurse i org_admin) widzi oczekujące zgłoszenie wraz z faktyczną datą zgonu
      for (const [role, uid] of [['nurse', s.nurseA], ['org_admin', s.adminA]] as const) {
        await asRole(tx, role, s.orgA, uid);
        const reports = await tx`SELECT resident_id, reported_death_date::text AS d, array_length(task_ids, 1) AS n FROM resident_death_reports WHERE resident_id = ${s.resA}`;
        expect(reports).toHaveLength(1);
        expect(reports[0].d).toBe('2026-10-28');
        expect(reports[0].n).toBe(3);
      }

      // Rodzina i opiekun prawny widzą podopiecznego (wciąż bez death_date), ale NIE widzą resident_death_reports ani zadań procedury
      for (const [role, uid] of [['family', s.familyA], ['legal_guardian', s.guardianA]] as const) {
        await asRole(tx, role, s.orgA, uid);
        const resRows = await tx`SELECT id, death_date FROM residents WHERE id = ${s.resA}`;
        expect(resRows).toHaveLength(1);
        expect(resRows[0].death_date).toBeNull();

        const deathReports = await tx`SELECT resident_id FROM resident_death_reports`;
        expect(deathReports, `${role}: brak dostępu do resident_death_reports`).toHaveLength(0);

        const agendaRows = await tx`SELECT id FROM agenda_items WHERE resident_id = ${s.resA}`;
        expect(agendaRows, `${role}: brak dostępu do zadań staff_only`).toHaveLength(0);
      }
    });
  }, 20000);

  it('@REQ: ORG-ISOLATION - nurse nie może zgłosić zgonu podopiecznego cudzej placówki ani przez RPC, ani przez bezpośredni INSERT do resident_events', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await asRole(tx, 'nurse', s.orgA, s.nurseA);

      // Próba wywołania RPC dla podopiecznego placówki B
      await failsWith(
        tx,
        /DEATH_REPORT_NOT_FOUND/,
        (sp) => sp`SELECT public.report_resident_death_atomic(${s.resB}::uuid, '2026-10-28'::date, NULL, '[]'::jsonb)`
      );

      // Próba bezpośredniego INSERT do resident_events z własnym organization_id (placówka A) i cudzym resident_id (placówka B)
      await failsWith(
        tx,
        /row-level security policy/,
        (sp) =>
          sp`INSERT INTO resident_events (organization_id, resident_id, event_type, event_date, event_reason, performed_by)
             VALUES (${s.orgA}, ${s.resB}, 'death_reported', '2026-10-28', 'death_reported', ${s.nurseA})`
      );

      // Próba bezpośredniego INSERT do resident_death_reports z własnym organization_id i cudzym resident_id
      await failsWith(
        tx,
        /row-level security policy/,
        (sp) =>
          sp`INSERT INTO resident_death_reports (resident_id, organization_id, reported_death_date, reported_by)
             VALUES (${s.resB}, ${s.orgA}, '2026-10-28', ${s.nurseA})`
      );
    });
  }, 20000);

  it('@REQ: ADM-BED-ASSIGNMENT - anulowanie zgłoszenia usuwa wyłącznie zadania procedury po zgonie i zapisuje ślad w audycie oraz resident_events', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);

      await asRole(tx, 'nurse', s.orgA, s.nurseA);
      const tasksJson = JSON.stringify([
        { target_date: '2026-10-28', time: '08:00', title: 'Procedura po zgonie: wezwanie lekarza do stwierdzenia zgonu i karty zgonu' },
        { target_date: '2026-10-28', time: '09:00', title: 'Procedura po zgonie: zabezpieczenie i spis depozytu rzeczy osobistych' },
        { target_date: '2026-10-28', time: '10:00', title: 'Sanityzacja i dezynfekcja miejsca' },
      ]);
      await tx`SELECT public.report_resident_death_atomic(${s.resA}::uuid, '2026-10-28'::date, NULL, ${tasksJson}::jsonb)`;

      // Duplikat zgłoszenia jest blokowany
      await failsWith(
        tx,
        /DEATH_ALREADY_REPORTED/,
        (sp) => sp`SELECT public.report_resident_death_atomic(${s.resA}::uuid, '2026-10-28'::date, NULL, '[]'::jsonb)`
      );

      // Przed anulowaniem są 4 zadania staff_only (1 wcześniejsze + 3 z procedury po zgonie)
      const beforeTasks = await tx`SELECT id FROM agenda_items WHERE resident_id = ${s.resA} AND type = 'staff_only'`;
      expect(beforeTasks).toHaveLength(4);

      // Kierownik placówki anuluje zgłoszenie
      await asRole(tx, 'org_admin', s.orgA, s.adminA);
      await tx`SELECT public.cancel_resident_death_report_atomic(${s.resA}::uuid)`;

      // Zgłoszenie w resident_death_reports usunięte
      const reportsAfter = await tx`SELECT resident_id FROM resident_death_reports WHERE resident_id = ${s.resA}`;
      expect(reportsAfter).toHaveLength(0);

      // Pozostało dokładnie wcześniejsze zadanie staff_only niezwiązane ze zgłoszeniem zgonu
      const afterTasks = await tx`SELECT id, title FROM agenda_items WHERE resident_id = ${s.resA} AND type = 'staff_only'`;
      expect(afterTasks).toHaveLength(1);
      expect(afterTasks[0].id).toBe(s.existingStaffTaskId);

      // Zdarzenie death_reported_cancelled i wpis audytu RESIDENT_DEATH_REPORT_CANCELLED zostały zapisane
      const cancelEvents = await tx`SELECT id FROM resident_events WHERE resident_id = ${s.resA} AND event_type = 'death_reported_cancelled'`;
      expect(cancelEvents).toHaveLength(1);

      const auditRows = await tx`SELECT id FROM audit_logs WHERE organization_id = ${s.orgA} AND action = 'RESIDENT_DEATH_REPORT_CANCELLED'`;
      expect(auditRows).toHaveLength(1);
    });
  }, 20000);
});
