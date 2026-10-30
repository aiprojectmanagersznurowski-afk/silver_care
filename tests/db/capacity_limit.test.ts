import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

/**
 * @REQ: ADM-CAPACITY-LIMIT
 *
 * Limit miejsc placówki (organizations.resident_limit) zmienia wyłącznie super admin (CAPACITY_POLICY.setBy).
 * Kierownik placówki nadal może aktualizować własną placówkę (settings, np. reguły łóżek z #149),
 * ale nie limit — także przez bezpośrednie zapytanie API i kluczem service_role (dawny import „po cichu”).
 * Każdy test działa w transakcji i kończy się ROLLBACK.
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

async function asRole(tx: Tx, claims: Record<string, unknown>) {
  await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
}

async function seedOrg(tx: Tx) {
  await tx`SET LOCAL ROLE authenticated`;
  await asRole(tx, { app_metadata: { role: 'super_admin' }, aal: 'aal2' });
  const [org] = await tx`INSERT INTO organizations (name, resident_limit) VALUES ('Placowka Limit Miejsc', 50) RETURNING id`;
  return org.id as string;
}

async function limitOf(tx: Tx, orgId: string) {
  await asRole(tx, { app_metadata: { role: 'super_admin' }, aal: 'aal2' });
  const [row] = await tx`SELECT resident_limit FROM organizations WHERE id = ${orgId}`;
  return Number(row.resident_limit);
}

describe('Limit miejsc zmienia wyłącznie super admin (ADM-CAPACITY-LIMIT)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('@REQ: ADM-CAPACITY-LIMIT - kierownik placówki nie zmieni resident_limit własnej placówki', async () => {
    await rollback(async (tx) => {
      const orgId = await seedOrg(tx);
      await asRole(tx, { app_metadata: { role: 'org_admin', organization_id: orgId }, aal: 'aal2' });
      const attempt = await tx.savepoint(async (sp) => {
        await sp`UPDATE organizations SET resident_limit = 80 WHERE id = ${orgId}`;
      }).then(() => 'zapisano', (e: Error) => e.message);
      expect(attempt).toMatch(/CAPACITY_LIMIT_SUPER_ADMIN_ONLY/);
      expect(await limitOf(tx, orgId)).toBe(50);
    });
  }, 30000);

  it('@REQ: ADM-CAPACITY-LIMIT - kierownik nadal aktualizuje settings własnej placówki (reguły łóżek)', async () => {
    await rollback(async (tx) => {
      const orgId = await seedOrg(tx);
      await asRole(tx, { app_metadata: { role: 'org_admin', organization_id: orgId }, aal: 'aal2' });
      const updated = await tx`UPDATE organizations SET settings = '{"bed_allocation_rules": {"x": 1}}'::jsonb WHERE id = ${orgId} RETURNING id`;
      expect(updated.length).toBe(1);
      expect(await limitOf(tx, orgId)).toBe(50);
    });
  }, 30000);

  it('@REQ: ADM-CAPACITY-LIMIT - klucz service_role (dawny masowy import) nie podnosi limitu', async () => {
    await rollback(async (tx) => {
      const orgId = await seedOrg(tx);
      await asRole(tx, { role: 'service_role' });
      const attempt = await tx.savepoint(async (sp) => {
        await sp`UPDATE organizations SET resident_limit = 120 WHERE id = ${orgId}`;
      }).then(() => 'zapisano', (e: Error) => e.message);
      expect(attempt).toMatch(/CAPACITY_LIMIT_SUPER_ADMIN_ONLY/);
      expect(await limitOf(tx, orgId)).toBe(50);
    });
  }, 30000);

  it('@REQ: ADM-CAPACITY-LIMIT - super admin zmienia limit miejsc', async () => {
    await rollback(async (tx) => {
      const orgId = await seedOrg(tx);
      await tx`UPDATE organizations SET resident_limit = 60 WHERE id = ${orgId}`;
      expect(await limitOf(tx, orgId)).toBe(60);
    });
  }, 30000);
});
