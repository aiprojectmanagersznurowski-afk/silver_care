import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
const migrationSql = readFileSync(join(process.cwd(), 'supabase/migrations/20261117120000_resident_photos_private_bucket.sql'), 'utf8');

/**
 * @REQ: ADM-RESIDENT-PHOTO
 * @REQ: ORG-ISOLATION
 *
 * SC-ADM-25: prywatny bucket resident-photos. Ścieżka <organization_id>/<resident_id>/<plik>.
 * Zapis tylko kierownik placówki dla swojej placówki; odczyt personel placówki i powiązani bliscy.
 */
type Tx = postgres.TransactionSql;

const asRole = (tx: Tx, role: string, orgId: string, sub: string) =>
  tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub, role: 'authenticated', app_metadata: { role, organization_id: orgId }, aal: 'aal2' })}, true)`;

async function rollback(fn: (tx: Tx) => Promise<void>) {
  await sql.begin(async (tx) => {
    await tx.unsafe(migrationSql);
    await fn(tx);
    throw new Error('ROLLBACK');
  }).catch((e) => {
    if (e.message !== 'ROLLBACK') throw e;
  });
}

async function attempt(tx: Tx, run: (sp: Tx) => Promise<unknown>) {
  return tx.savepoint(async (sp) => { await run(sp as unknown as Tx); }).then(() => 'ok', (e: Error) => e.message);
}

async function seed(tx: Tx) {
  const [orgA] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Foto A') RETURNING id`;
  const [orgB] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Foto B') RETURNING id`;
  const mk = async (role: string, org: string) => {
    const [u] = await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data, raw_user_meta_data) VALUES (gen_random_uuid(), 'authenticated', 'authenticated', ${tx.json({ role, organization_id: org })}, '{}'::jsonb) RETURNING id`;
    return u.id as string;
  };
  const adminA = await mk('org_admin', orgA.id), nurseA = await mk('nurse', orgA.id), familyA = await mk('family', orgA.id), adminB = await mk('org_admin', orgB.id);
  const [resA] = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgA.id}, 'Maria', 'Foto', 'hash-foto-a') RETURNING id`;
  const [resA2] = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgA.id}, 'Jan', 'Obcy', 'hash-foto-a2') RETURNING id`;
  await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role) VALUES (${resA.id}, ${familyA}, 'SON', 'family')`;
  await tx`SET LOCAL ROLE authenticated`;
  const path = (res: string, org = orgA.id as string) => `${org}/${res}/zdjecie.webp`;
  return { orgA: orgA.id as string, orgB: orgB.id as string, adminA, nurseA, familyA, adminB, resA: resA.id as string, resA2: resA2.id as string, path };
}

const put = (tx: Tx, name: string) => tx`INSERT INTO storage.objects (bucket_id, name) VALUES ('resident-photos', ${name})`;

describe('Prywatne zdjęcie podopiecznego (@REQ: ADM-RESIDENT-PHOTO)', () => {
  afterAll(async () => { await sql.end(); });

  it('@REQ: ADM-RESIDENT-PHOTO - bucket resident-photos jest prywatny, residents ma photo_path', async () => {
    await rollback(async (tx) => {
      const [b] = await tx`SELECT public FROM storage.buckets WHERE id = 'resident-photos'`;
      expect(b.public).toBe(false);
      const [c] = await tx`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='residents' AND column_name='photo_path'`;
      expect(c.n).toBe(1);
    });
  });

  it('@REQ: ADM-RESIDENT-PHOTO - kierownik wgrywa i usuwa zdjęcie podopiecznego swojej placówki', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await asRole(tx, 'org_admin', s.orgA, s.adminA);
      expect(await attempt(tx, (sp) => put(sp, s.path(s.resA)))).toBe('ok');
      // Bezpośredni DELETE w SQL blokuje Supabase (tylko Storage API) — sprawdzamy warunek polityki DELETE
      const [w] = await tx`SELECT public.resident_photo_writable(${s.path(s.resA)}) AS ok`;
      expect(w.ok).toBe(true);
      await asRole(tx, 'nurse', s.orgA, s.nurseA);
      const [n] = await tx`SELECT public.resident_photo_writable(${s.path(s.resA)}) AS ok`;
      expect(n.ok).toBe(false);
      const policies = await tx`SELECT cmd FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'resident_photos_%' ORDER BY cmd`;
      expect(policies.map((p) => p.cmd)).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
    });
  });

  it('@REQ: ORG-ISOLATION - pielęgniarka, rodzina i kierownik innej placówki nie wgrają zdjęcia', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      for (const [role, org, sub] of [['nurse', s.orgA, s.nurseA], ['family', s.orgA, s.familyA], ['org_admin', s.orgB, s.adminB]] as const) {
        await asRole(tx, role, org, sub);
        expect(await attempt(tx, (sp) => put(sp, s.path(s.resA))), `${role}@${org === s.orgB ? 'B' : 'A'}`).toMatch(/row-level security/);
      }
      // Kierownik nie podłoży pliku pod cudzą placówkę ani pod ścieżkę bez podopiecznego swojej placówki
      await asRole(tx, 'org_admin', s.orgA, s.adminA);
      expect(await attempt(tx, (sp) => put(sp, s.path(s.resA, s.orgB)))).toMatch(/row-level security/);
      expect(await attempt(tx, (sp) => put(sp, `${s.orgA}/${s.orgA}/x.webp`))).toMatch(/row-level security/);
    });
  });

  it('@REQ: ADM-RESIDENT-PHOTO - odczyt: personel placówki i powiązany bliski; bliski nie widzi cudzego podopiecznego', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await asRole(tx, 'org_admin', s.orgA, s.adminA);
      await put(tx, s.path(s.resA));
      await put(tx, s.path(s.resA2));
      const names = async () => (await tx`SELECT name FROM storage.objects WHERE bucket_id = 'resident-photos' ORDER BY name`).map((r) => r.name as string);

      await asRole(tx, 'nurse', s.orgA, s.nurseA);
      expect(await names()).toHaveLength(2);
      await asRole(tx, 'family', s.orgA, s.familyA);
      expect(await names()).toEqual([s.path(s.resA)]);
      await asRole(tx, 'org_admin', s.orgB, s.adminB);
      expect(await names()).toHaveLength(0);
    });
  });
});
