import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

describe('Staff Account Management Isolation & Audit (NUR-STAFF-MANAGEMENT)', () => {
  let sql: postgres.Sql;

  beforeAll(() => {
    sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
  });

  afterAll(async () => {
    await sql.end();
  });

  it('blocks org_admin from managing staff belonging to another organization @REQ: ORG-ISOLATION', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;

      const orgA = await tx`INSERT INTO organizations (name) VALUES ('Org A Staff') RETURNING id`;
      const orgB = await tx`INSERT INTO organizations (name) VALUES ('Org B Staff') RETURNING id`;

      const adminAId = '12121212-1212-1212-1212-121212121212';
      const staffBId = '34343434-3434-3434-3434-343434343434';

      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
        sub: adminAId,
        app_metadata: { role: 'org_admin', organization_id: orgA[0].id },
        aal: 'aal2'
      })}, true)`;

      let blocked = false;
      let savepointErr;
      await tx`SAVEPOINT sp_cross_org`;
      try {
        await tx`SELECT public.log_staff_management_action(${staffBId}, 'staff_password_reset', ${orgB[0].id})`;
      } catch (err: any) {
        blocked = true;
        savepointErr = err;
        await tx`ROLLBACK TO sp_cross_org`;
      }

      expect(blocked).toBe(true);
      expect(savepointErr.message).toMatch(/Cannot manage staff from another organization/);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });

  it('allows org_admin to log staff management within own organization @REQ: SEC-AUDIT-APPEND-ONLY', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;

      const orgA = await tx`INSERT INTO organizations (name) VALUES ('Org A Staff Audit') RETURNING id`;
      const orgId = orgA[0].id;

      const adminAId = '56565656-5656-5656-5656-565656565656';
      const staffAId = '78787878-7878-7878-7878-787878787878';

      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
        sub: adminAId,
        app_metadata: { role: 'org_admin', organization_id: orgId },
        aal: 'aal2'
      })}, true)`;

      await tx`SELECT public.log_staff_management_action(${staffAId}, 'staff_password_reset', ${orgId})`;

      // Verify audit log entry under postgres role
      await tx`SET LOCAL ROLE postgres`;
      const logs = await tx`SELECT * FROM public.audit_logs WHERE performed_by = ${adminAId} AND action = 'staff_password_reset'`;
      expect(logs.length).toBe(1);
      expect(logs[0].payload.target_user_id).toBe(staffAId);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
