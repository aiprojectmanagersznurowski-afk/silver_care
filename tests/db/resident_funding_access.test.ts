import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
const migrationSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261116190000_resident_funding.sql'),
  'utf8'
);

/**
 * @REQ: ADM-RESIDENT-FUNDING
 * @REQ: ORG-ISOLATION
 *
 * Źródło finansowania pobytu (SC-ADM-24) w osobnej tabeli resident_funding:
 * czyta i zmienia wyłącznie kierownik placówki; pielęgniarka, rodzina i opiekun prawny
 * nie widzą żadnego wiersza; wartość spoza listy odrzuca baza; brak zapisu między placówkami.
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
  const [orgA] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Fin A') RETURNING id`;
  const [orgB] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Fin B') RETURNING id`;

  const mkUser = async (role: string, orgId: string) => {
    const [u] = await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data, raw_user_meta_data)
      VALUES (gen_random_uuid(), 'authenticated', 'authenticated', ${tx.json({ role, organization_id: orgId })}, '{}'::jsonb) RETURNING id`;
    return u.id as string;
  };

  const adminA = await mkUser('org_admin', orgA.id);
  const nurseA = await mkUser('nurse', orgA.id);
  const familyA = await mkUser('family', orgA.id);
  const guardianA = await mkUser('legal_guardian', orgA.id);

  const [resA] = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash)
    VALUES (${orgA.id}, 'Maria', 'Testowa', 'hash-fin-a') RETURNING id`;
  const [resB] = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash)
    VALUES (${orgB.id}, 'Piotr', 'Obcy', 'hash-fin-b') RETURNING id`;

  await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role) VALUES
    (${resA.id}, ${familyA}, 'SON', 'family'),
    (${resA.id}, ${guardianA}, 'GUARDIAN', 'legal_guardian')`;

  await tx`SET LOCAL ROLE authenticated`;

  return { orgA: orgA.id as string, orgB: orgB.id as string, adminA, nurseA, familyA, guardianA, resA: resA.id as string, resB: resB.id as string };
}

describe('Źródło finansowania pobytu — tylko kierownik placówki (@REQ: ADM-RESIDENT-FUNDING, @REQ: ORG-ISOLATION)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('@REQ: ADM-RESIDENT-FUNDING - kierownik placówki zapisuje, zmienia i odczytuje źródło finansowania', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await asRole(tx, 'org_admin', s.orgA, s.adminA);

      await tx`INSERT INTO resident_funding (resident_id, organization_id, funding_source, updated_by)
        VALUES (${s.resA}, ${s.orgA}, 'municipality', ${s.adminA})`;
      await tx`UPDATE resident_funding SET funding_source = 'co_financed' WHERE resident_id = ${s.resA}`;

      const rows = await tx`SELECT funding_source FROM resident_funding WHERE resident_id = ${s.resA}`;
      expect(rows.map((r) => r.funding_source)).toEqual(['co_financed']);

      // Brak polityki DELETE: wiersz zostaje
      await tx`DELETE FROM resident_funding WHERE resident_id = ${s.resA}`;
      const after = await tx`SELECT 1 FROM resident_funding WHERE resident_id = ${s.resA}`;
      expect(after).toHaveLength(1);
    });
  });

  it('@REQ: ADM-RESIDENT-FUNDING - pielęgniarka, rodzina i opiekun prawny nie odczytają ani nie zapiszą źródła finansowania', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await asRole(tx, 'org_admin', s.orgA, s.adminA);
      await tx`INSERT INTO resident_funding (resident_id, organization_id, funding_source, updated_by)
        VALUES (${s.resA}, ${s.orgA}, 'private', ${s.adminA})`;

      for (const [role, sub] of [['nurse', s.nurseA], ['family', s.familyA], ['legal_guardian', s.guardianA]] as const) {
        await asRole(tx, role, s.orgA, sub);
        const rows = await tx`SELECT * FROM resident_funding WHERE resident_id = ${s.resA}`;
        expect(rows, `rola ${role} nie powinna widzieć wiersza`).toHaveLength(0);
        await failsWith(tx, /row-level security/, (sp) =>
          sp`UPDATE resident_funding SET funding_source = 'other' WHERE resident_id = ${s.resA} RETURNING 1`.then((r) => {
            if (r.length === 0) throw new Error('row-level security: brak zmienionych wierszy');
          })
        );
      }

      await asRole(tx, 'nurse', s.orgA, s.nurseA);
      await failsWith(tx, /row-level security/, (sp) =>
        sp`INSERT INTO resident_funding (resident_id, organization_id, funding_source, updated_by)
          VALUES (${s.resA}, ${s.orgA}, 'other', ${s.nurseA}) ON CONFLICT (resident_id) DO NOTHING`
      );
    });
  });

  it('@REQ: ADM-RESIDENT-FUNDING - baza odrzuca wartość spoza listy', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await asRole(tx, 'org_admin', s.orgA, s.adminA);
      await failsWith(tx, /check constraint/, (sp) =>
        sp`INSERT INTO resident_funding (resident_id, organization_id, funding_source, updated_by)
          VALUES (${s.resA}, ${s.orgA}, 'nfz', ${s.adminA})`
      );
    });
  });

  it('@REQ: ORG-ISOLATION - kierownik nie zapisze źródła finansowania podopiecznego innej placówki', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await asRole(tx, 'org_admin', s.orgA, s.adminA);
      await failsWith(tx, /row-level security/, (sp) =>
        sp`INSERT INTO resident_funding (resident_id, organization_id, funding_source, updated_by)
          VALUES (${s.resB}, ${s.orgA}, 'private', ${s.adminA})`
      );
      await failsWith(tx, /row-level security/, (sp) =>
        sp`INSERT INTO resident_funding (resident_id, organization_id, funding_source, updated_by)
          VALUES (${s.resB}, ${s.orgB}, 'private', ${s.adminA})`
      );
    });
  });
});
