import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Database 403 Logging (SEC-403-LOGGING)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('limits RPC execution to trusted server roles @REQ: SEC-403-LOGGING', async () => {
    const signature = 'public.log_access_denied(uuid,uuid,text,jsonb)';
    const [privileges] = await sql`
      SELECT
        has_function_privilege('anon', ${signature}, 'EXECUTE') AS anonymous,
        has_function_privilege('authenticated', ${signature}, 'EXECUTE') AS authenticated,
        has_function_privilege('service_role', ${signature}, 'EXECUTE') AS service_role
    `;

    expect(privileges).toEqual({ anonymous: false, authenticated: false, service_role: true });
  });

  it('log_access_denied records 403 attempts without PII @REQ: SEC-403-LOGGING', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org 403') RETURNING id`;
      const orgId = org[0].id;

      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      
      // Simulate access denied
      await tx`SET LOCAL ROLE service_role`;
      await tx`SELECT public.log_access_denied(${orgId}, null, 'READ_RESIDENT', '{"ip": "192.168.1.1"}'::jsonb)`;
      await tx`SET LOCAL ROLE authenticated`;

      const logs = await tx`SELECT * FROM audit_logs WHERE organization_id = ${orgId} AND action = 'ACCESS_DENIED'`;
      expect(logs.length).toBe(1);
      expect(logs[0].payload.ip).toBe('192.168.1.1');

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 30000);
});
