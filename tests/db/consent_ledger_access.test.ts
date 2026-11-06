import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

/**
 * @REQ: CONSENT-LEDGER-IMMUTABLE
 * @REQ: CONSENT-GRANTOR
 * @REQ: CONSENT-REVOKE
 *
 * Rejestr zgód (dane art. 9 RODO) zgodnie z macierzą uprawnień: czyta wyłącznie kierownik placówki (własnej)
 * i opiekun prawny (zgody swojego podopiecznego). Bliski w roli family, personel opiekuńczy i konto anonimowe
 * nie widzą rejestru. Zgodę cofa wyłącznie kierownik placówki albo powiązany opiekun prawny; cofnięcie jest
 * jednorazowe (revoked_at się nie zmienia) i zostawia ślad z autorem. Każdy test w transakcji z ROLLBACK.
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
  tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub, role: 'authenticated', app_metadata: { role, organization_id: orgId }, aal: 'aal2' })}, true)`;

async function failsWith(tx: Tx, pattern: RegExp, run: (sp: Tx) => Promise<unknown>) {
  const result = await tx.savepoint(async (sp) => { await run(sp as unknown as Tx); }).then(() => 'wykonano', (e: Error) => e.message);
  expect(result).toMatch(pattern);
}

async function seed(tx: Tx) {
  const [orgA] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Zgody A') RETURNING id`;
  const [orgB] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Zgody B') RETURNING id`;
  const mkUser = async (role: string, orgId: string) => {
    const [u] = await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data, raw_user_meta_data)
      VALUES (gen_random_uuid(), 'authenticated', 'authenticated', ${tx.json({ role, organization_id: orgId })}, '{}'::jsonb) RETURNING id`;
    return u.id as string;
  };
  const admin = await mkUser('org_admin', orgA.id);
  const adminB = await mkUser('org_admin', orgB.id);
  const nurse = await mkUser('nurse', orgA.id);
  const family = await mkUser('family', orgA.id);
  const guardian = await mkUser('legal_guardian', orgA.id);
  const [r1] = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgA.id}, 'Anna', 'Zgodna', 'hash-zgody-1') RETURNING id`;
  const [r2] = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgA.id}, 'Jan', 'Obcy', 'hash-zgody-2') RETURNING id`;
  await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role) VALUES
    (${r1.id}, ${guardian}, 'GUARDIAN', 'legal_guardian'), (${r1.id}, ${family}, 'SON', 'family')`;
  const [c1] = await tx`INSERT INTO consent_ledger (organization_id, resident_id, purpose, granted_by)
    VALUES (${orgA.id}, ${r1.id}, 'wellness_data_ingest', 'legal_guardian') RETURNING id`;
  const [c2] = await tx`INSERT INTO consent_ledger (organization_id, resident_id, purpose, granted_by)
    VALUES (${orgA.id}, ${r2.id}, 'wellness_data_ingest', 'resident_self') RETURNING id`;
  await tx`SET LOCAL ROLE authenticated`;
  return { orgA: orgA.id as string, orgB: orgB.id as string, admin, adminB, nurse, family, guardian, c1: c1.id as string, c2: c2.id as string };
}
type Seed = Awaited<ReturnType<typeof seed>>;

const visible = async (tx: Tx, s: Seed) => {
  const rows = await tx`SELECT id FROM consent_ledger WHERE id IN (${s.c1}, ${s.c2})`;
  return rows.map((r) => r.id as string).sort();
};

describe('Rejestr zgód — odczyt według macierzy uprawnień (@REQ: CONSENT-LEDGER-IMMUTABLE)', () => {
  it('@REQ: CONSENT-LEDGER-IMMUTABLE - kierownik placówki czyta zgody swojej placówki, a nie innej', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await as(tx, 'org_admin', s.orgA, s.admin);
      expect(await visible(tx, s)).toEqual([s.c1, s.c2].sort());
      await as(tx, 'org_admin', s.orgB, s.adminB);
      expect(await visible(tx, s)).toEqual([]);
    });
  });

  it('@REQ: CONSENT-LEDGER-IMMUTABLE - opiekun prawny czyta wyłącznie zgody swojego podopiecznego', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await as(tx, 'legal_guardian', s.orgA, s.guardian);
      expect(await visible(tx, s)).toEqual([s.c1]);
    });
  });

  it('@REQ: CONSENT-GRANTOR - bliski w roli family i personel opiekuńczy nie czytają rejestru zgód, także powiązanego podopiecznego', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await as(tx, 'family', s.orgA, s.family);
      expect(await visible(tx, s)).toEqual([]);
      await as(tx, 'nurse', s.orgA, s.nurse);
      expect(await visible(tx, s)).toEqual([]);
    });
  });

  it('@REQ: CONSENT-LEDGER-IMMUTABLE - konto anonimowe nie czyta rejestru zgód', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await tx`SET LOCAL ROLE anon`;
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ role: 'anon' })}, true)`;
      expect(await visible(tx, s)).toEqual([]);
    });
  });
});

describe('Cofnięcie zgody — revoke_consent (@REQ: CONSENT-REVOKE, @REQ: CONSENT-GRANTOR)', () => {
  it('@REQ: CONSENT-GRANTOR - bliski w roli family, personel opiekuńczy i opiekun cudzego podopiecznego nie cofną zgody', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await as(tx, 'family', s.orgA, s.family);
      await failsWith(tx, /CONSENT_REVOKE_FORBIDDEN/, (sp) => sp`SELECT public.revoke_consent(${s.c1})`);
      await as(tx, 'nurse', s.orgA, s.nurse);
      await failsWith(tx, /CONSENT_REVOKE_FORBIDDEN/, (sp) => sp`SELECT public.revoke_consent(${s.c1})`);
      await as(tx, 'legal_guardian', s.orgA, s.guardian);
      await failsWith(tx, /CONSENT_REVOKE_FORBIDDEN/, (sp) => sp`SELECT public.revoke_consent(${s.c2})`);
      await as(tx, 'org_admin', s.orgB, s.adminB);
      await failsWith(tx, /CONSENT_NOT_FOUND/, (sp) => sp`SELECT public.revoke_consent(${s.c1})`);
      await tx`RESET ROLE`;
      const rows = await tx`SELECT count(*)::int AS n FROM consent_ledger WHERE id IN (${s.c1}, ${s.c2}) AND revoked_at IS NOT NULL`;
      expect(rows[0].n).toBe(0);
    });
  });

  it('@REQ: CONSENT-REVOKE - konto anonimowe nie ma prawa wykonania revoke_consent', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await tx`SET LOCAL ROLE anon`;
      await failsWith(tx, /permission denied/, (sp) => sp`SELECT public.revoke_consent(${s.c1})`);
    });
  });

  it('@REQ: CONSENT-REVOKE - opiekun prawny cofa zgodę swojego podopiecznego; ślad w audycie ma autora, bez treści', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await as(tx, 'legal_guardian', s.orgA, s.guardian);
      await tx`SELECT public.revoke_consent(${s.c1})`;
      await tx`RESET ROLE`;
      const [c] = await tx`SELECT revoked_at FROM consent_ledger WHERE id = ${s.c1}`;
      expect(c.revoked_at).not.toBeNull();
      const [log] = await tx`SELECT performed_by, resident_id, payload FROM audit_logs
        WHERE action = 'CONSENT_WITHDRAWN' AND payload->>'consent_id' = ${s.c1}`;
      expect(log.performed_by).toBe(s.guardian);
      expect(Object.keys(log.payload)).toEqual(['consent_id']);
    });
  });

  it('@REQ: CONSENT-LEDGER-IMMUTABLE - cofniętej zgody nie da się cofnąć ponownie; revoked_at się nie zmienia', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await as(tx, 'org_admin', s.orgA, s.admin);
      await tx`SELECT public.revoke_consent(${s.c2})`;
      const [first] = await tx`SELECT revoked_at FROM consent_ledger WHERE id = ${s.c2}`;
      await failsWith(tx, /CONSENT_ALREADY_REVOKED/, (sp) => sp`SELECT public.revoke_consent(${s.c2})`);
      const [second] = await tx`SELECT revoked_at FROM consent_ledger WHERE id = ${s.c2}`;
      expect(second.revoked_at).toEqual(first.revoked_at);
    });
  });
});

afterAll(async () => {
  await sql.end();
});
