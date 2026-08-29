import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

describe('Database Impersonation (SUP-IMPERSONATION)', () => {
  let sql: postgres.Sql;

  beforeAll(() => {
    sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
  });

  afterAll(async () => {
    await sql.end();
  });

  it('restricts delete and security updates during impersonation @REQ: SUP-IMPERSONATION', async () => {
    await sql.begin(async (tx) => {
      // 1. Setup as postgres
      await tx`SET LOCAL ROLE postgres`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Imp Org') RETURNING id`;
      const orgId = org[0].id;
      
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Imp', 'Test', 'hashImp') RETURNING id`;
      const resId = res[0].id;

      // 2. Impersonate org_admin
      await tx`SET LOCAL ROLE authenticated`;
      const superAdminId = '99999999-9999-9999-9999-999999999999';
      const targetAdminId = '88888888-8888-8888-8888-888888888888';
      
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${targetAdminId}", "app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "impersonator_id": "${superAdminId}", "aal": "aal2"}`}, true)`;
      
      // Try to read residents (should work)
      const readRes = await tx`SELECT * FROM residents WHERE id = ${resId}`;
      expect(readRes.length).toBe(1);

      // Try to delete a resident (should fail because of impersonation)
      const deletePromise = tx`SELECT public.hard_delete_resident(${resId})`;
      await expect(deletePromise).rejects.toThrowError(/Cannot perform destructive actions during impersonation/);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });

  it('logs impersonation start @REQ: SUP-IMPERSONATION', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Log Org') RETURNING id`;
      
      await tx`SET LOCAL ROLE authenticated`;
      const superAdminId = '99999999-9999-9999-9999-999999999999';
      const targetAdminId = '88888888-8888-8888-8888-888888888888';
      
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${superAdminId}", "app_metadata": {"role": "super_admin"}, "aal": "aal2"}`}, true)`;
      
      const logEntry = await tx`SELECT public.log_impersonation_start(${targetAdminId}, ${org[0].id})`;
      
      await tx`SET LOCAL ROLE postgres`;
      const logs = await tx`SELECT * FROM audit_logs WHERE action = 'IMPERSONATE_START' AND performed_by = ${superAdminId}`;
      expect(logs.length).toBe(1);
      expect(logs[0].payload.target_admin_id).toBe(targetAdminId);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
