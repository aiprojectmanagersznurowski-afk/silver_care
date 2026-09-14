import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

let sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

describe('Impersonation Security & Audit Trail (SC-SUP-02)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('records IMPERSONATE_START and IMPERSONATE_STOP in audit_logs @REQ: SUP-IMPERSONATION', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      const [org] = await tx`INSERT INTO organizations (name) VALUES ('Audit Imp Org') RETURNING id`;
      const orgId = org.id;

      const superAdminId = '99999999-9999-9999-9999-999999999999';
      const targetAdminId = '88888888-8888-8888-8888-888888888888';

      // 1. Log impersonation start as super_admin
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${superAdminId}", "app_metadata": {"role": "super_admin"}, "aal": "aal2"}`}, true)`;

      await tx`SELECT public.log_impersonation_start(${targetAdminId}, ${orgId})`;

      // 2. Log impersonation stop
      await tx`SELECT public.log_impersonation_stop(${targetAdminId}, ${orgId})`;

      // 3. Verify audit_logs entries
      await tx`SET LOCAL ROLE postgres`;
      const startLogs = await tx`
        SELECT * FROM audit_logs
        WHERE organization_id = ${orgId}
          AND action = 'IMPERSONATE_START'
      `;
      expect(startLogs.length).toBe(1);
      expect(startLogs[0].payload.target_admin_id).toBe(targetAdminId);

      const stopLogs = await tx`
        SELECT * FROM audit_logs
        WHERE organization_id = ${orgId}
          AND action = 'IMPERSONATE_STOP'
      `;
      expect(stopLogs.length).toBe(1);
      expect(stopLogs[0].payload.target_admin_id).toBe(targetAdminId);

      throw new Error('ROLLBACK');
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });

  it('blocks direct DELETE on residents when impersonator_id is present in JWT claims @REQ: SUP-IMPERSONATION', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      const [org] = await tx`INSERT INTO organizations (name) VALUES ('Destruct Block Org') RETURNING id`;
      const [res] = await tx`
        INSERT INTO residents (organization_id, first_name, last_name, pesel_hash)
        VALUES (${org.id}, 'Jan', 'Bezpieczny', 'hashBezpieczny')
        RETURNING id
      `;

      // Simulate impersonated session: org_admin role with impersonator_id claim set
      await tx`SET LOCAL ROLE authenticated`;
      const superAdminId = '99999999-9999-9999-9999-999999999999';
      const targetAdminId = '88888888-8888-8888-8888-888888888888';

      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${targetAdminId}", "app_metadata": {"role": "org_admin", "organization_id": "${org.id}"}, "impersonator_id": "${superAdminId}", "aal": "aal2"}`}, true)`;

      let deleteErr: any;
      try {
        await tx.savepoint(async (sp) => {
          await sp`DELETE FROM residents WHERE id = ${res.id}`;
        });
      } catch (e) {
        deleteErr = e;
      }

      expect(deleteErr).toBeDefined();
      expect(deleteErr.message).toMatch(/Cannot perform destructive actions during impersonation/);

      throw new Error('ROLLBACK');
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
