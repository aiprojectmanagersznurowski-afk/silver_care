import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Database Integration Normalization (INT-NORMALIZATION)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('normalize_and_ingest converts ISO8601 durations to minutes @REQ: INT-NORMALIZATION', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Org Norm') RETURNING id`;
      const orgId = org[0].id;
      
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Anna', 'Norm', 'hashNorm') RETURNING id`;
      const resId = res[0].id;

      // Grant consent
      await tx`INSERT INTO consent_ledger (organization_id, resident_id, granted_by, purpose) VALUES (${orgId}, ${resId}, 'resident_self', 'wellness_data_ingest')`;

      await tx`SET LOCAL ROLE authenticated`;
      const ingestSub = '55555555-5555-5555-5555-555555555555';
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${ingestSub}", "app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      
      // Attempt ingest via normalize_and_ingest with PT8H30M
      await tx`SELECT public.normalize_and_ingest(${orgId}, ${resId}, 'polar', 'sleep_duration', 'PT8H30M', 'dedup-norm-1')`;

      await tx`SET LOCAL ROLE postgres`;
      // Check that it was inserted as 510 minutes
      const ingestData = await tx`SELECT * FROM physiological_data_ingest WHERE resident_id = ${resId}`;
      expect(ingestData.length).toBe(1);
      expect(parseFloat(ingestData[0].value)).toBe(510); // 8 * 60 + 30 = 510

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
