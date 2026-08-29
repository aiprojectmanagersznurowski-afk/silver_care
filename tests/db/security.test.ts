import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Database Security MFA (SEC-MFA-STAFF)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('rejects staff queries if MFA (aal2) is not present, allows family without MFA @REQ: SEC-MFA-STAFF', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      
      // Super admin setup for org
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('MFA Test Org') RETURNING id`;
      const orgId = org[0].id;
      
      // Setup resident as org_admin (with aal2 because current system allows it before MFA is enforced, but let's be safe)
      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Nowak', 'hash') RETURNING id`;

      // 1. org_admin WITHOUT MFA (aal1) should fail to read residents
      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal1"}`}, true)`;
      
      let err1;
      await tx`SAVEPOINT no_mfa_staff`;
      try {
        await tx`SELECT * FROM residents`;
      } catch (e) {
        err1 = e;
        await tx`ROLLBACK TO no_mfa_staff`;
      }
      expect(err1).toBeDefined();
      expect((err1 as any).message).toMatch(/MFA \(aal2\) required for staff/);

      // 2. org_admin WITH MFA (aal2) should succeed
      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      const res1 = await tx`SELECT * FROM residents`;
      expect(res1.length).toBe(1);

      // 3. legal_guardian WITHOUT MFA (aal1) should succeed
      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "legal_guardian", "organization_id": "${orgId}"}, "aal": "aal1"}`}, true)`;
      
      let err3;
      await tx`SAVEPOINT no_mfa_family`;
      try {
        await tx`SELECT * FROM residents`;
      } catch (e) {
        err3 = e;
        await tx`ROLLBACK TO no_mfa_family`;
      }
      expect(err3).toBeUndefined(); // Should NOT throw!

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
