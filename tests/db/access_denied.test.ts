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

  it('log_access_denied records 403 attempts without PII @REQ: SEC-403-LOGGING', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org 403') RETURNING id`;
      const orgId = org[0].id;

      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      
      // Simulate access denied
      await tx`SELECT public.log_access_denied(${orgId}, null, 'READ_RESIDENT', '{"ip": "192.168.1.1"}'::jsonb)`;

      const logs = await tx`SELECT * FROM audit_logs WHERE organization_id = ${orgId} AND action = 'ACCESS_DENIED'`;
      expect(logs.length).toBe(1);
      expect(logs[0].payload.ip).toBe('192.168.1.1');

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 30000);
});
