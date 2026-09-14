import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

let sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

describe('Organization Provisioning Flow & Audit (SC-SUP-03)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('provisions organization with address, resident_limit, admin account and audit log @REQ: ORG-PROVISION', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      const superAdminId = '99999999-9999-9999-9999-999999999999';
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${superAdminId}", "app_metadata": {"role": "super_admin"}, "aal": "aal2"}`}, true)`;

      const orgName = 'Nowy Dom Seniora Promyk';
      const adminEmail = 'dyrektor@promyk-senior.pl';
      const address = 'ul. Lipowa 12, Krakow';
      const residentLimit = 75;
      const adminName = 'Jan Dyrektor';

      const [res] = await tx`
        SELECT public.provision_organization(
          ${orgName},
          ${adminEmail},
          ${address},
          ${residentLimit},
          ${adminName}
        ) AS org_id
      `;

      expect(res.org_id).toBeDefined();
      const orgId = res.org_id;

      // 1. Check organizations table
      const [org] = await tx`SELECT * FROM organizations WHERE id = ${orgId}`;
      expect(org.name).toBe(orgName);
      expect(org.address).toBe(address);
      expect(Number(org.resident_limit)).toBe(75);

      // 2. Check audit_logs
      await tx`SET LOCAL ROLE postgres`;
      const logs = await tx`
        SELECT * FROM audit_logs
        WHERE organization_id = ${orgId}
          AND action = 'ORGANIZATION_CREATED'
      `;
      expect(logs.length).toBe(1);
      expect(logs[0].payload.organization_name).toBe(orgName);
      expect(logs[0].payload.admin_user_id).toBeDefined();
      expect(logs[0].payload.resident_limit).toBe(75);

      throw new Error('ROLLBACK');
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });

  it('rejects provisioning from non-super_admin @REQ: ORG-PROVISION', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "org_admin", "organization_id": "00000000-0000-0000-0000-000000000001"}, "aal": "aal2"}', true)`;

      let err: any;
      try {
        await tx.savepoint(async (sp) => {
          await sp`
            SELECT public.provision_organization(
              'Hack Org',
              'hacker@hack.pl',
              'ul. Ciemna 1',
              10
            )
          `;
        });
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.message).toMatch(/Odmowa dostępu: Wymagana rola super_admin/);

      throw new Error('ROLLBACK');
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
