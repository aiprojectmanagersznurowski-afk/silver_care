import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Database FAM-DASHBOARD (Family Report View)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('restricts family to see only PUBLISHED daily reports @REQ: FAM-DASHBOARD', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Org Dashboard Test') RETURNING id`;
      const orgId = org[0].id;

      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Kowalski', 'hash-res') RETURNING id`;
      const resId = res[0].id;
      
      const nurseId = '22222222-2222-2222-2222-222222222222';
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${nurseId}", "app_metadata": {"role": "nurse", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;

      // Insert two reports: DRAFT and PUBLISHED
      await tx`INSERT INTO daily_reports (resident_id, author_id, content, status) VALUES (${resId}, ${nurseId}, '{"msg": "This is a draft"}', 'DRAFT')`;
      await tx`INSERT INTO daily_reports (resident_id, author_id, content, status) VALUES (${resId}, ${nurseId}, '{"msg": "This is published"}', 'PUBLISHED')`;

      // Org admin again for linking
      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      // Link family
      const familyUid = '11111111-1111-1111-1111-111111111111';
      await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role) VALUES (${resId}, ${familyUid}, 'SON', 'family')`;

      // Query as family
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${familyUid}", "app_metadata": {"role": "family", "organization_id": "${orgId}"}, "aal": "aal1"}`}, true)`;

      const results = await tx`SELECT content, status FROM daily_reports WHERE resident_id = ${resId}`;
      
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PUBLISHED');
      expect(results[0].content.msg).toBe('This is published');

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 10000);
});
