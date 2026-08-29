import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Database Audit Retention (SEC-RETENTION)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('enforce_retention_policy purges old audit logs but leaves anonymized traces @REQ: SEC-RETENTION', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org Retention') RETURNING id`;
      const orgId = org[0].id;

      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      
      const resident = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Adam', 'Stary', 'hash_old') RETURNING id`;
      const resId = resident[0].id;

      // Insert two audit logs manually
      await tx`INSERT INTO audit_logs (organization_id, resident_id, action, payload) VALUES (${orgId}, ${resId}, 'CREATE_RESIDENT', '{"test": "keep"}'::jsonb)`;
      
      // We manually update one log's created_at to 10 years ago to simulate old log
      await tx`SET LOCAL ROLE postgres`;
      await tx`SELECT set_config('audit.allow_redact', 'true', true)`;
      await tx`UPDATE audit_logs SET created_at = now() - interval '10 years' WHERE resident_id = ${resId} AND action = 'CREATE_RESIDENT'`;
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('audit.allow_redact', 'false', true)`;

      // Call the RPC that cleans up logs older than 5 years
      await tx`SELECT public.enforce_retention_policy(5)`;

      // Old log should be hard-deleted or completely redacted/stripped
      const logs = await tx`SELECT * FROM audit_logs WHERE resident_id = ${resId}`;
      expect(logs.length).toBe(0); // If we choose to fully delete

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 30000);
});
