import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Database Agenda Items (FAM-AGENDA)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('restricts family members to see only common items and items of linked residents @REQ: FAM-AGENDA', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org Agenda') RETURNING id`;
      const orgId = org[0].id;

      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      
      const res1 = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Kowalski', 'hash1') RETURNING id`;
      const res2 = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Anna', 'Nowak', 'hash2') RETURNING id`;

      // Create agenda items
      // 1. Common item
      await tx`INSERT INTO agenda_items (organization_id, resident_id, title, time, type) VALUES (${orgId}, null, 'Sniadanie', '08:00', 'MEAL')`;
      // 2. Res1 item
      await tx`INSERT INTO agenda_items (organization_id, resident_id, title, time, type) VALUES (${orgId}, ${res1[0].id}, 'Rehabilitacja', '10:00', 'PHYSIO')`;
      // 3. Res2 item
      await tx`INSERT INTO agenda_items (organization_id, resident_id, title, time, type) VALUES (${orgId}, ${res2[0].id}, 'Wizyta lekarska', '11:00', 'MEDICAL')`;

      // Link a family member (user UUID: gen_random_uuid()) to res1
      const familyUid = '00000000-0000-0000-0000-000000000001';
      await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role) VALUES (${res1[0].id}, ${familyUid}, 'SON', 'family')`;

      // Now query as the family member
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${familyUid}", "app_metadata": {"role": "family", "organization_id": "${orgId}"}, "aal": "aal1"}`}, true)`;

      const results = await tx`SELECT title, resident_id FROM agenda_items`;
      
      const titles = results.map(r => r.title);
      
      expect(titles).toContain('Sniadanie'); // common
      expect(titles).toContain('Rehabilitacja'); // res1
      expect(titles).not.toContain('Wizyta lekarska'); // res2 - should be hidden

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 10000);
});
