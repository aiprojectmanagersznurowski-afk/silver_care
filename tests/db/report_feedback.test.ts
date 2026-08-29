import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

describe('Database Report Feedback (REPORT-AI-FEEDBACK)', () => {
  let sql: postgres.Sql;

  beforeAll(() => {
    sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
  });

  afterAll(async () => {
    await sql.end();
  });

  it('allows nurse to submit feedback and blocks publishing if feedback exists @REQ: REPORT-AI-FEEDBACK', async () => {
    await sql.begin(async (tx) => {
      // 1. Setup org & resident as postgres
      await tx`SET LOCAL ROLE postgres`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Org Feedback') RETURNING id`;
      const orgId = org[0].id;
      
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Feedback', 'hashFB') RETURNING id`;
      const resId = res[0].id;

      // 2. Insert draft report as nurse
      await tx`SET LOCAL ROLE authenticated`;
      const nurseSub = '11111111-1111-1111-1111-111111111111';
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${nurseSub}", "app_metadata": {"role": "nurse", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      
      const report = await tx`INSERT INTO daily_reports (resident_id, author_id, content, status) VALUES (${resId}, ${nurseSub}, '{"msg": "Draft with AI"}', 'DRAFT') RETURNING id`;
      const reportId = report[0].id;

      // 3. Nurse submits feedback
      // Assuming categories: 'INACCURATE', 'HALLUCINATION', 'OTHER'
      const feedback = await tx`INSERT INTO report_feedback (report_id, reporter_id, category, snapshot, prompt_version) VALUES (${reportId}, ${nurseSub}, 'INACCURATE', '{"msg": "Draft with AI"}', 'v1.0') RETURNING id`;
      expect(feedback.length).toBe(1);

      // 4. Nurse tries to publish the report (should fail due to feedback trigger)
      const publishPromise = tx`UPDATE daily_reports SET status = 'PUBLISHED', approved_by = ${nurseSub} WHERE id = ${reportId}`;
      await expect(publishPromise).rejects.toThrowError(/Cannot publish a report that has pending feedback/);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
