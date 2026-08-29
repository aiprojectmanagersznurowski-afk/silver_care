import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Consent Ledger Constraints (CONSENT-GRANTOR, CONSENT-REVOKE)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('rejects consent from unauthorized grantors @REQ: CONSENT-GRANTOR', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Org Consent') RETURNING id`;
      const orgId = org[0].id;
      
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Grantor', 'hashGrant') RETURNING id`;
      const resId = res[0].id;

      // valid
      await tx`INSERT INTO consent_ledger (organization_id, resident_id, purpose, granted_by) VALUES (${orgId}, ${resId}, 'wellness_data_ingest', 'legal_guardian')`;

      // invalid
      await expect(
        tx`INSERT INTO consent_ledger (organization_id, resident_id, purpose, granted_by) VALUES (${orgId}, ${resId}, 'wellness_data_ingest', 'family')`
      ).rejects.toThrow(/valid_grantor/);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });

  it('revoke_consent updates revoked_at but does not delete row @REQ: CONSENT-REVOKE', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Org Revoke') RETURNING id`;
      const orgId = org[0].id;
      
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Revoker', 'hashRev') RETURNING id`;
      const resId = res[0].id;

      const consent = await tx`INSERT INTO consent_ledger (organization_id, resident_id, purpose, granted_by) VALUES (${orgId}, ${resId}, 'wellness_data_ingest', 'resident_self') RETURNING id`;
      const consentId = consent[0].id;

      await tx`SET LOCAL ROLE authenticated`;
      const nurseSub = '77777777-7777-7777-7777-777777777777';
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${nurseSub}", "app_metadata": {"role": "nurse", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;

      // invoke RPC
      await tx`SELECT public.revoke_consent(${consentId})`;

      await tx`SET LOCAL ROLE postgres`;
      const check = await tx`SELECT * FROM consent_ledger WHERE id = ${consentId}`;
      expect(check.length).toBe(1);
      expect(check[0].revoked_at).not.toBeNull();

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
