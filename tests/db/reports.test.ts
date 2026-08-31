import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

describe('Database Reports (REPORT-APPROVAL, CARE-REPORTS-CORE)', () => {
  let sql: postgres.Sql;

  beforeAll(() => {
    sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
  });

  afterAll(async () => {
    await sql.end();
  });

  it('restricts family from reading daily_reports before they are published @REQ: REPORT-APPROVAL', async () => {
    await sql.begin(async (tx) => {
      // 1. Setup org & resident as postgres
      await tx`SET LOCAL ROLE postgres`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Org Reports') RETURNING id`;
      const orgId = org[0].id;
      
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Raport', 'hashRep') RETURNING id`;
      const resId = res[0].id;

      // 2. Insert draft report as nurse
      await tx`SET LOCAL ROLE authenticated`;
      const nurseSub = '11111111-1111-1111-1111-111111111111';
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${nurseSub}", "app_metadata": {"role": "nurse", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      
      const report = await tx`INSERT INTO daily_reports (resident_id, author_id, content, status) VALUES (${resId}, ${nurseSub}, '{"msg": "Draft"}', 'DRAFT') RETURNING id`;
      expect(report.length).toBe(1);
      
      // Nurse can read draft
      const readDraftA = await tx`SELECT * FROM daily_reports WHERE id = ${report[0].id}`;
      expect(readDraftA.length).toBe(1);

      // 3. Family cannot read draft
      const familySub = '33333333-3333-3333-3333-333333333333';
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${familySub}", "app_metadata": {"role": "family"}}`}, true)`;
      
      // Note: we might need a link in resident_relative_links for family to read anything.
      // Setup the link first via postgres
      await tx`SET LOCAL ROLE postgres`;
      await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role) VALUES (${resId}, ${familySub}, 'son', 'family')`;

      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${familySub}", "app_metadata": {"role": "family"}}`}, true)`;
      const readFamilyDraft = await tx`SELECT * FROM daily_reports WHERE id = ${report[0].id}`;
      expect(readFamilyDraft.length).toBe(0); // Should return nothing due to RLS

      // 4. Nurse publishes report
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${nurseSub}", "app_metadata": {"role": "nurse", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      await tx`UPDATE daily_reports SET status = 'PUBLISHED', approved_by = ${nurseSub} WHERE id = ${report[0].id}`;

      // 5. Family can read published report
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${familySub}", "app_metadata": {"role": "family"}}`}, true)`;
      const readFamilyPub = await tx`SELECT * FROM daily_reports WHERE id = ${report[0].id}`;
      expect(readFamilyPub.length).toBe(1);

      await tx`ROLLBACK`;
    });
  });

  it('allows nurse to manage daily_logs @REQ: VOICE-DRAFT-ISOLATION', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Org Logs') RETURNING id`;
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${org[0].id}, 'Log', 'Test', 'hashLog') RETURNING id`;
      
      await tx`SET LOCAL ROLE authenticated`;
      const nurseSub = '11111111-1111-1111-1111-111111111111';
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${nurseSub}", "app_metadata": {"role": "nurse", "organization_id": "${org[0].id}"}, "aal": "aal2"}`}, true)`;
      
      const log = await tx`INSERT INTO daily_logs (resident_id, nurse_id, data) VALUES (${res[0].id}, ${nurseSub}, '{"action": "meds"}') RETURNING id`;
      expect(log.length).toBe(1);

      const allLogs = await tx`SELECT id FROM daily_logs WHERE id = ${log[0].id}`;
      expect(allLogs.length).toBe(1);

      await tx`ROLLBACK`;
    });
  });
});
