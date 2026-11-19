import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
const migrationSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261116210000_family_residents_no_table_read.sql'),
  'utf8'
);
// SC-ADM-25: RPC rodziny zwraca ścieżkę zdjęcia z prywatnego bucketu zamiast publicznego avatar_url
const photoRpcSql = readFileSync(join(process.cwd(), 'supabase/migrations/20261117130000_family_overview_photo_path.sql'), 'utf8');

/**
 * @REQ: FAM-RESIDENT-DATA-MINIMIZATION
 * @REQ: FAM-AGENDA
 * @REQ: ORG-ISOLATION
 * @REQ: ADM-RESIDENT-PHOTO
 *
 * SC-FAM-08: bliscy nie odczytują tabeli residents (pesel_hash, is_zsn, notes, dane umowy);
 * jedyną ścieżką jest get_family_resident_overview z jawną listą 7 kolumn. Plan dnia placówki
 * (resident_id IS NULL) nadal widoczny dla bliskiego z aktywnym powiązaniem; personel bez zmian.
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
    await tx.unsafe(photoRpcSql);
    await fn(tx);
    throw new Error('ROLLBACK');
  }).catch((e) => {
    if (e.message !== 'ROLLBACK') throw e;
  });
}

async function seed(tx: Tx) {
  const [org] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Minimalizacja') RETURNING id`;
  const mkUser = async (role: string) => {
    const [u] = await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data, raw_user_meta_data)
      VALUES (gen_random_uuid(), 'authenticated', 'authenticated', ${tx.json({ role, organization_id: org.id })}, '{}'::jsonb) RETURNING id`;
    return u.id as string;
  };
  const family = await mkUser('family');
  const guardian = await mkUser('legal_guardian');
  const nurse = await mkUser('nurse');

  const [res] = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash, is_zsn, care_level, notes, contract_monthly_rate)
    VALUES (${org.id}, 'Maria', 'Testowa', 'hash-min-a', true, 'bedridden', 'Uwaga przyjęciowa personelu', 5200) RETURNING id`;
  await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role) VALUES
    (${res.id}, ${family}, 'SON', 'family'),
    (${res.id}, ${guardian}, 'GUARDIAN', 'legal_guardian')`;
  await tx`INSERT INTO agenda_items (organization_id, resident_id, target_date, time, type, title)
    VALUES (${org.id}, NULL, CURRENT_DATE, '15:00', 'activity', 'Koncert w świetlicy')`;

  await tx`SET LOCAL ROLE authenticated`;
  return { org: org.id as string, family, guardian, nurse, res: res.id as string };
}

describe('Bliscy bez odczytu tabeli residents (@REQ: FAM-RESIDENT-DATA-MINIMIZATION)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('@REQ: FAM-RESIDENT-DATA-MINIMIZATION - rodzina i opiekun prawny dostają zero wierszy z residents', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      for (const [role, sub] of [['family', s.family], ['legal_guardian', s.guardian]] as const) {
        await asRole(tx, role, s.org, sub);
        const rows = await tx`SELECT id, pesel_hash, is_zsn, notes, contract_monthly_rate FROM residents WHERE id = ${s.res}`;
        expect(rows, role).toHaveLength(0);
      }
    });
  });

  it('@REQ: FAM-RESIDENT-DATA-MINIMIZATION - get_family_resident_overview zwraca wyłącznie 7 jawnych kolumn', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await asRole(tx, 'family', s.org, s.family);
      const rows = await tx`SELECT * FROM public.get_family_resident_overview()`;
      expect(rows).toHaveLength(1);
      expect(Object.keys(rows[0]).sort()).toEqual(['archived_at', 'contract_end_date', 'death_date', 'first_name', 'id', 'last_name', 'photo_path']);
      expect(rows[0].id).toBe(s.res);
    });
  });

  it('@REQ: FAM-AGENDA - plan dnia placówki nadal widoczny dla bliskiego z aktywnym powiązaniem', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await asRole(tx, 'family', s.org, s.family);
      const rows = await tx`SELECT title FROM agenda_items WHERE organization_id = ${s.org} AND resident_id IS NULL`;
      expect(rows.map((r) => r.title)).toEqual(['Koncert w świetlicy']);
    });
  });

  it('@REQ: ORG-ISOLATION - personel nadal czyta podopiecznych swojej placówki', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await asRole(tx, 'nurse', s.org, s.nurse);
      const rows = await tx`SELECT id FROM residents WHERE id = ${s.res}`;
      expect(rows).toHaveLength(1);
    });
  });
});
