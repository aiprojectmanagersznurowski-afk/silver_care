import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
const migrationSql = readFileSync(join(process.cwd(), 'supabase/migrations/20261117140000_avatars_write_admins_only.sql'), 'utf8');

/**
 * @REQ: ORG-ISOLATION
 * @REQ: SEC-SESSION
 *
 * Publiczny bucket avatars (do czasu przeniesienia zdjęć, WO-ADM-RESIDENT-PHOTO): wgrywać, nadpisywać
 * i usuwać pliki może wyłącznie kierownik placówki albo super admin — nie pielęgniarka, nie rodzina.
 */
type Tx = postgres.TransactionSql;

const asRole = (tx: Tx, role: string, aal = 'aal2') =>
  tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: '00000000-0000-0000-0000-00000000a0a0', role: 'authenticated', aal, app_metadata: { role, organization_id: '00000000-0000-0000-0000-00000000b0b0' } })}, true)`;

async function rollback(fn: (tx: Tx) => Promise<void>) {
  await sql.begin(async (tx) => {
    const [state] = await tx`SELECT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_admins_insert'
    ) AS applied`;
    if (!state.applied) await tx.unsafe(migrationSql);
    await tx`SET LOCAL ROLE authenticated`;
    await fn(tx);
    throw new Error('ROLLBACK');
  }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
}

const tryPut = (tx: Tx, name: string) =>
  tx.savepoint(async (sp) => { await sp`INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars', ${name})`; }).then(() => 'ok', (e: Error) => e.message);

describe('Bucket avatars — zapis tylko kierownik placówki i super admin (@REQ: ORG-ISOLATION)', () => {
  afterAll(async () => { await sql.end(); });

  it('@REQ: ORG-ISOLATION - pielęgniarka, rodzina i opiekun prawny nie wgrają pliku do avatars', async () => {
    await rollback(async (tx) => {
      for (const role of ['nurse', 'family', 'legal_guardian']) {
        await asRole(tx, role);
        expect(await tryPut(tx, `staff/test-${role}.webp`), role).toMatch(/row-level security/);
      }
    });
  });

  it('@REQ: ORG-ISOLATION - kierownik placówki i super admin wgrywają (zaproszenie personelu ze zdjęciem)', async () => {
    await rollback(async (tx) => {
      for (const role of ['org_admin', 'super_admin']) {
        await asRole(tx, role);
        expect(await tryPut(tx, `staff/test-${role}.webp`), role).toBe('ok');
      }
    });
  });

  it('@REQ: SEC-SESSION - polityki UPDATE i DELETE avatars wymagają roli kierownika albo super admina', async () => {
    await rollback(async (tx) => {
      const rows = await tx`SELECT cmd, coalesce(qual, with_check) AS rule FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND cmd IN ('UPDATE', 'DELETE') AND coalesce(qual, with_check) LIKE '%avatars%'`;
      expect(rows.map((r) => r.cmd).sort()).toEqual(['DELETE', 'UPDATE']);
      for (const r of rows) expect(r.rule, r.cmd).toMatch(/org_admin/);
    });
  });

  it('@REQ: SEC-MFA-STAFF - konto kierownika z aal1 nie wgrywa pliku do avatars', async () => {
    await rollback(async (tx) => {
      await asRole(tx, 'org_admin', 'aal1');
      expect(await tryPut(tx, 'staff/test-aal1.webp')).toMatch(/MFA \(aal2\) required/);
    });
  });
});
