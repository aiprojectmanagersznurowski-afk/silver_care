import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

describe('IAM Panel & Role Management (SUP-IAM-PANEL)', () => {
  let sql: postgres.Sql;

  beforeAll(() => {
    sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
  });

  afterAll(async () => {
    await sql.end();
  });

  it('allows super_admin to view audit logs and restricts other roles @REQ: SUP-IAM-PANEL', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('IAM Test Org') RETURNING id`;
      const orgId = org[0].id;

      const superAdminId = '11111111-1111-1111-1111-111111111111';
      const orgAdminId = '22222222-2222-2222-2222-222222222222';
      const targetUserId = '33333333-3333-3333-3333-333333333333';

      // Insert audit log via postgres
      await tx`INSERT INTO audit_logs (organization_id, action, performed_by, payload) VALUES (${orgId}, 'role_change', ${superAdminId}, ${JSON.stringify({ target_user_id: targetUserId, new_role: 'org_admin' })})`;

      // 1. super_admin can read audit logs
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${superAdminId}", "app_metadata": {"role": "super_admin"}, "aal": "aal2"}`}, true)`;

      const superLogs = await tx`SELECT * FROM audit_logs WHERE action = 'role_change'`;
      expect(superLogs.length).toBeGreaterThanOrEqual(1);

      // 2. org_admin cannot access another org audit logs or global role changes without org match
      const otherOrg = await tx`INSERT INTO organizations (name) VALUES ('Other Org') RETURNING id`;
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${orgAdminId}", "app_metadata": {"role": "org_admin", "organization_id": "${otherOrg[0].id}"}, "aal": "aal2"}`}, true)`;

      const orgAdminLogs = await tx`SELECT * FROM audit_logs WHERE organization_id = ${orgId}`;
      expect(orgAdminLogs.length).toBe(0);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });

  it('rejects role changes by non-super_admin and logs role_change securely @REQ: SUP-IAM-PANEL', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('IAM Security Org') RETURNING id`;
      const orgId = org[0].id;

      const superAdminId = '11111111-1111-1111-1111-111111111111';
      const intruderId = '44444444-4444-4444-4444-444444444444';
      const targetUserId = '55555555-5555-5555-5555-555555555555';

      // 1. Intruder (nurse or org_admin) tries to call log_role_change
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${intruderId}", "app_metadata": {"role": "nurse", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;

      const intruderCall = tx.savepoint(sp => sp`SELECT public.log_role_change(${targetUserId}, 'org_admin', 'nurse', ${orgId})`);
      await expect(intruderCall).rejects.toThrowError(/super_admin/);

      // 2. super_admin calls log_role_change successfully
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${superAdminId}", "app_metadata": {"role": "super_admin"}, "aal": "aal2"}`}, true)`;

      await tx`SELECT public.log_role_change(${targetUserId}, 'org_admin', 'nurse', ${orgId})`;

      const logged = await tx`SELECT * FROM audit_logs WHERE action = 'role_change' AND performed_by = ${superAdminId}`;
      expect(logged.length).toBe(1);
      expect(logged[0].payload.new_role).toBe('org_admin');
      expect(logged[0].payload.previous_role).toBe('nurse');
      expect(logged[0].payload.target_user_id).toBe(targetUserId);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });

  it('logs user creation role assignment without previous_role @REQ: SUP-IAM-PANEL', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      const superAdminId = '11111111-1111-1111-1111-111111111111';
      const newUserId = '66666666-6666-6666-6666-666666666666';

      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${superAdminId}", "app_metadata": {"role": "super_admin"}, "aal": "aal2"}`}, true)`;

      await tx`SELECT public.log_role_change(${newUserId}, 'nurse', NULL, NULL)`;

      const logged = await tx`SELECT * FROM audit_logs WHERE action = 'role_change' AND performed_by = ${superAdminId}`;
      expect(logged.length).toBe(1);
      expect(logged[0].payload.new_role).toBe('nurse');
      expect(logged[0].payload.previous_role).toBeNull();
      expect(logged[0].payload.target_user_id).toBe(newUserId);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });

  it('logs password reset securely and rejects unauthorized callers @REQ: SUP-IAM-PANEL', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      const superAdminId = '11111111-1111-1111-1111-111111111111';
      const intruderId = '44444444-4444-4444-4444-444444444444';
      const targetUserId = '77777777-7777-7777-7777-777777777777';

      // 1. Non-super_admin fails
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${intruderId}", "app_metadata": {"role": "nurse"}, "aal": "aal2"}`}, true)`;

      const intruderCall = tx.savepoint(sp => sp`SELECT public.log_password_reset(${targetUserId}, NULL)`);
      await expect(intruderCall).rejects.toThrowError(/super_admin/);

      // 2. super_admin succeeds
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${superAdminId}", "app_metadata": {"role": "super_admin"}, "aal": "aal2"}`}, true)`;
      await tx`SELECT public.log_password_reset(${targetUserId}, NULL)`;

      const logged = await tx`SELECT * FROM audit_logs WHERE action = 'password_reset' AND performed_by = ${superAdminId}`;
      expect(logged.length).toBe(1);
      expect(logged[0].payload.target_user_id).toBe(targetUserId);
      expect(logged[0].payload.password).toBeUndefined();

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});

