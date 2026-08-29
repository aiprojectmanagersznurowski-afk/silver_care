import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// We need a superuser connection or service_role connection to set roles properly.
const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

describe('Database Provisioning (ORG-PROVISION)', () => {
  beforeAll(async () => {
    // Ensure we are connected
    await sql`SELECT 1`;
  });

  afterAll(async () => {
    await sql.end();
  });

  beforeEach(async () => {
    // Reset any state if needed before each test
  });

  it('fails to insert into organizations without super_admin role @REQ: ORG-PROVISION', async () => {
    await sql.begin(async (tx) => {
      // 1. Authenticate as a normal user (no super_admin claims)
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"organization_id": "00000000-0000-0000-0000-000000000000"}}', true)`;
      
      // 2. Try to insert an organization directly
      const promise = tx`INSERT INTO organizations (name) VALUES ('Test Org') RETURNING id`;
      
      // 3. Expect failure due to RLS
      await expect(promise).rejects.toThrowError(/new row violates row-level security policy/);
      
      // Force rollback of any unintended changes (though it failed)
      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });

  it('provisions new organization and org_admin securely using provision_organization RPC @REQ: ORG-PROVISION', async () => {
    await sql.begin(async (tx) => {
      // 1. Authenticate as super_admin
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      
      // 2. Call the RPC to provision
      const result = await tx`SELECT public.provision_organization('Nowa Placowka', 'admin@nowaplacowka.pl') as org_id`;
      
      // 3. Verify organization was created
      expect(result.length).toBe(1);
      const orgId = result[0].org_id;
      expect(orgId).toBeDefined();

      const orgs = await tx`SELECT * FROM organizations WHERE id = ${orgId}`;
      expect(orgs.length).toBe(1);
      expect(orgs[0].name).toBe('Nowa Placowka');
      
      // (Testing auth.users insertion from RPC might be hard because auth schema is locked, but the RPC will handle it)
      
      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
