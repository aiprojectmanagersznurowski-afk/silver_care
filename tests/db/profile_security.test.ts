import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

describe('Self-Service Profile Security Logging (NUR-PROFILE-SECURITY)', () => {
  let sql: postgres.Sql;

  beforeAll(() => {
    sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
  });

  afterAll(async () => {
    await sql.end();
  });

  it('logs password_self_change to security_access_logs and audit_logs @REQ: SEC-AUDIT-APPEND-ONLY @REQ: SEC-SESSION', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Profile Sec Org') RETURNING id`;
      const orgId = org[0].id;
      const userId = '77777777-7777-7777-7777-777777777777';

      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
        sub: userId,
        app_metadata: { role: 'nurse', organization_id: orgId },
        aal: 'aal2'
      })}, true)`;

      // Call log_self_password_change RPC
      await tx`SELECT public.log_self_password_change()`;

      // Check security_access_logs: user can read own security logs
      const secLogs = await tx`SELECT * FROM public.security_access_logs WHERE performed_by = ${userId} AND action = 'password_self_change'`;
      expect(secLogs.length).toBe(1);

      // Check audit_logs: under postgres/org_admin, verify entry was written immutably
      await tx`SET LOCAL ROLE postgres`;
      const auditLogs = await tx`SELECT * FROM public.audit_logs WHERE performed_by = ${userId} AND action = 'password_self_change'`;
      expect(auditLogs.length).toBe(1);

      // Another unprivileged user cannot see user's security_access_logs
      await tx`SET LOCAL ROLE authenticated`;
      const otherUser = '66666666-6666-6666-6666-666666666666';
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
        sub: otherUser,
        app_metadata: { role: 'nurse', organization_id: orgId },
        aal: 'aal2'
      })}, true)`;

      const otherSecLogs = await tx`SELECT * FROM public.security_access_logs WHERE performed_by = ${userId}`;
      expect(otherSecLogs.length).toBe(0);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
