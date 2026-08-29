import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Database Sync Staleness (INT-SYNC-STALENESS)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('resident_sync_status view reports staleness based on latest ingest @REQ: INT-SYNC-STALENESS', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Org Sync') RETURNING id`;
      const orgId = org[0].id;
      
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Piotr', 'Sync', 'hashSync') RETURNING id`;
      const resId = res[0].id;

      // Check view, no data should be OFFLINE
      let status = await tx`SELECT sync_state FROM public.resident_sync_status WHERE resident_id = ${resId}`;
      expect(status[0].sync_state).toBe('OFFLINE');

      // Grant consent and insert data
      await tx`INSERT INTO consent_ledger (organization_id, resident_id, granted_by, purpose) VALUES (${orgId}, ${resId}, 'resident_self', 'wellness_data_ingest')`;
      await tx`INSERT INTO physiological_data_ingest (organization_id, resident_id, metric, value, recorded_at) VALUES (${orgId}, ${resId}, 'heart_rate', 70, now())`;

      // Status should be ACTIVE now
      status = await tx`SELECT sync_state FROM public.resident_sync_status WHERE resident_id = ${resId}`;
      expect(status[0].sync_state).toBe('ACTIVE');

      // Update to 15 hours ago
      await tx`UPDATE physiological_data_ingest SET recorded_at = now() - interval '15 hours' WHERE resident_id = ${resId}`;
      status = await tx`SELECT sync_state FROM public.resident_sync_status WHERE resident_id = ${resId}`;
      expect(status[0].sync_state).toBe('STALE');

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
