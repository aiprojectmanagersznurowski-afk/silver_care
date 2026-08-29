import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Database Consent Logic (CONSENT-*)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('allows inserting valid consent, prevents UPDATE/DELETE, and revokes properly @REQ: CONSENT-GRANTOR @REQ: CONSENT-REVOKE @REQ: CONSENT-LEDGER-IMMUTABLE', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org Consent') RETURNING id`;
      const orgId = org[0].id;

      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}}`}, true)`;
      const resident = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Anna', 'Kowalska', 'hash_consent') RETURNING id`;
      const resId = resident[0].id;

      // Create consent
      const consent = await tx`
        INSERT INTO consent_ledger (organization_id, resident_id, purpose, granted_by)
        VALUES (${orgId}, ${resId}, 'wellness_data_ingest', 'resident_self')
        RETURNING id
      `;
      const consentId = consent[0].id;
      expect(consentId).toBeDefined();

      // Try invalid purpose
      let err1;
      await tx`SAVEPOINT invalid_purpose`;
      try {
        await tx`INSERT INTO consent_ledger (organization_id, resident_id, purpose, granted_by) VALUES (${orgId}, ${resId}, 'invalid_purpose', 'resident_self')`;
      } catch (e) {
        err1 = e;
        await tx`ROLLBACK TO invalid_purpose`;
      }
      expect(err1).toBeDefined();

      // Try UPDATE (should fail or throw)
      let err2;
      await tx`SAVEPOINT update_consent`;
      try {
        await tx`UPDATE consent_ledger SET purpose = 'medical_records_access' WHERE id = ${consentId}`;
      } catch (e) {
        err2 = e;
        await tx`ROLLBACK TO update_consent`;
      }
      // Depending on how RLS/trigger is implemented, it might silently fail or throw
      // If it throws, err2 is defined. If it silently fails, we check later.
      if (!err2) {
          const updatedConsent = await tx`SELECT purpose FROM consent_ledger WHERE id = ${consentId}`;
          expect(updatedConsent[0].purpose).toBe('wellness_data_ingest');
      }

      // Try DELETE
      let err3;
      await tx`SAVEPOINT delete_consent`;
      try {
        await tx`DELETE FROM consent_ledger WHERE id = ${consentId}`;
      } catch (e) {
        err3 = e;
        await tx`ROLLBACK TO delete_consent`;
      }
      if (!err3) {
          const checkDel = await tx`SELECT id FROM consent_ledger WHERE id = ${consentId}`;
          expect(checkDel.length).toBe(1);
      }

      // Revoke consent
      await tx`SELECT public.revoke_consent(${consentId})`;
      
      const revoked = await tx`SELECT revoked_at FROM consent_ledger WHERE id = ${consentId}`;
      expect(revoked[0].revoked_at).not.toBeNull();

      // Check audit log
      const logs = await tx`SELECT action FROM audit_logs WHERE resident_id = ${resId} AND action = 'CONSENT_WITHDRAWN'`;
      expect(logs.length).toBe(1);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 30000);
});
