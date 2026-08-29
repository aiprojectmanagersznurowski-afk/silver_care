import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

describe('MDR Security (MDR-NO-PHYSIO-TO-FAMILY)', () => {
  let sql: postgres.Sql;

  beforeAll(() => {
    sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
  });

  afterAll(async () => {
    await sql.end();
  });

  it('restricts family role from reading physiological_data_ingest @REQ: MDR-NO-PHYSIO-TO-FAMILY', async () => {
    await sql.begin(async (tx) => {
      // 1. Setup org & resident as postgres
      await tx`SET LOCAL ROLE postgres`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Org MDR') RETURNING id`;
      const orgId = org[0].id;
      
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'MDR', 'hashMDR') RETURNING id`;
      const resId = res[0].id;

      // 2. Insert physiological data as postgres (simulating ingest process)
      await tx`INSERT INTO physiological_data_ingest (organization_id, resident_id, metric, value, deduplication_id) VALUES (${orgId}, ${resId}, 'heart_rate', 80, 'mdr-pkg-1')`;

      // 3. Setup Family Link
      const familySub = '77777777-7777-7777-7777-777777777777';
      await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role) VALUES (${resId}, ${familySub}, 'son', 'family')`;

      // 4. Try to read data as family
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${familySub}", "app_metadata": {"role": "family"}}`}, true)`;
      
      const familyRead = await tx`SELECT * FROM physiological_data_ingest WHERE resident_id = ${resId}`;
      expect(familyRead.length).toBe(0); // RLS should block reading

      // 5. Try to read data as nurse (should be successful)
      const nurseSub = '88888888-8888-8888-8888-888888888888';
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${nurseSub}", "app_metadata": {"role": "nurse", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;

      const nurseRead = await tx`SELECT * FROM physiological_data_ingest WHERE resident_id = ${resId}`;
      expect(nurseRead.length).toBe(1);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
