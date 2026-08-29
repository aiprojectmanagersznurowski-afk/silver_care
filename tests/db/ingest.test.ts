import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

describe('Database Ingest Preconditions (INT-INGEST-PRECONDITIONS)', () => {
  let sql: postgres.Sql;

  beforeAll(() => {
    sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
  });

  afterAll(async () => {
    await sql.end();
  });

  it('rejects ingest if no active consent exists and logs it @REQ: INT-INGEST-PRECONDITIONS', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Org Ingest') RETURNING id`;
      const orgId = org[0].id;
      
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Ingest', 'hashIng') RETURNING id`;
      const resId = res[0].id;

      await tx`SET LOCAL ROLE authenticated`;
      const ingestSub = '44444444-4444-4444-4444-444444444444';
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${ingestSub}", "app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      
      // Attempt ingest via RPC
      await tx`SELECT public.process_ingest_payload(${orgId}, ${resId}, 'heart_rate', 70, 'pkg-1')`;

      await tx`SET LOCAL ROLE postgres`;
      // Check that it was NOT inserted
      const ingestData = await tx`SELECT * FROM physiological_data_ingest WHERE resident_id = ${resId}`;
      expect(ingestData.length).toBe(0);

      // Check audit log
      const logs = await tx`SELECT * FROM audit_logs WHERE action = 'INGEST_REJECTED'`;
      expect(logs.length).toBe(1);
      expect(logs[0].payload.reason).toBe('No active consent');

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });

  it('rejects ingest if deduplication_id is duplicate @REQ: INT-INGEST-PRECONDITIONS', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Org Ingest 2') RETURNING id`;
      const orgId = org[0].id;
      
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Ingest2', 'hashIng2') RETURNING id`;
      const resId = res[0].id;

      // Grant consent
      await tx`INSERT INTO consent_ledger (organization_id, resident_id, granted_by, purpose) VALUES (${orgId}, ${resId}, 'resident_self', 'wellness_data_ingest')`;

      await tx`SET LOCAL ROLE authenticated`;
      const ingestSub = '44444444-4444-4444-4444-444444444444';
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${ingestSub}", "app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      
      // First ingest
      await tx`SELECT public.process_ingest_payload(${orgId}, ${resId}, 'heart_rate', 70, 'pkg-2')`;
      
      // Second ingest with same deduplication_id
      await tx`SELECT public.process_ingest_payload(${orgId}, ${resId}, 'heart_rate', 75, 'pkg-2')`;

      await tx`SET LOCAL ROLE postgres`;
      // Check that only ONE was inserted
      const ingestData = await tx`SELECT * FROM physiological_data_ingest WHERE resident_id = ${resId}`;
      expect(ingestData.length).toBe(1);
      expect(ingestData[0].value).toBe('70'); // numeric comes back as string

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
