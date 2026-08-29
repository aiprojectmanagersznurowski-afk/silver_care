import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Database Notifications (NTF-REPORT-READY, NTF-NO-PII)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('generates notification in outbox without PII when report is published @REQ: NTF-REPORT-READY @REQ: NTF-NO-PII', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Org Ntf') RETURNING id`;
      const orgId = org[0].id;
      
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Ntf', 'hashNtf') RETURNING id`;
      const resId = res[0].id;

      // Create a draft report
      const rep = await tx`INSERT INTO daily_reports (resident_id, author_id, status, content) VALUES (${resId}, '55555555-5555-5555-5555-555555555555', 'DRAFT', '{"text": "Draft"}') RETURNING id`;
      const reportId = rep[0].id;

      // Publish the report
      await tx`UPDATE daily_reports SET status = 'PUBLISHED' WHERE id = ${reportId}`;

      // Check outbox
      const outbox = await tx`SELECT * FROM outbox_notifications WHERE entity_id = ${reportId} AND entity_type = 'report'`;
      expect(outbox.length).toBe(1);
      
      // Ensure no PII in payload
      const payload = outbox[0].payload;
      expect(payload.message).toBe('New report is ready'); // Generic text
      expect(payload).not.toHaveProperty('first_name');
      expect(payload).not.toHaveProperty('last_name');

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
