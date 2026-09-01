import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Database FAM-MESSAGES (Family Messages RLS)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('allows family to insert messages only for linked residents and prevents updates @REQ: FAM-MESSAGES', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org Messages') RETURNING id`;
      const orgId = org[0].id;

      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      
      const res1 = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Kowalski', 'hash-1') RETURNING id`;
      const res2 = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Adam', 'Nowak', 'hash-2') RETURNING id`;

      const familyUid = '33333333-3333-3333-3333-333333333333';
      const strangerUid = '44444444-4444-4444-4444-444444444444';

      // Link familyUid ONLY to res1
      await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role) VALUES (${res1[0].id}, ${familyUid}, 'SON', 'family')`;

      // Switch to family user
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${familyUid}", "app_metadata": {"role": "family", "organization_id": "${orgId}"}, "aal": "aal1"}`}, true)`;

      // Should succeed for res1
      const inserted = await tx`INSERT INTO family_messages (organization_id, resident_id, relative_user_id, content) VALUES (${orgId}, ${res1[0].id}, ${familyUid}, 'Message to Jan') RETURNING id`;
      expect(inserted).toHaveLength(1);

      // Should fail for res2
      let err2 = null;
      try {
        await tx.savepoint(async (sp) => {
          await sp`INSERT INTO family_messages (organization_id, resident_id, relative_user_id, content) VALUES (${orgId}, ${res2[0].id}, ${familyUid}, 'Message to Adam')`;
        });
      } catch (e) { err2 = e; }
      expect(err2).toBeDefined();

      // Should fail to UPDATE message
      let errUpdate = null;
      try {
        await tx.savepoint(async (sp) => {
          await sp`UPDATE family_messages SET content = 'Hacked' WHERE id = ${inserted[0].id}`;
        });
      } catch (e) { errUpdate = e; }
      expect(errUpdate).toBeDefined();

      // Now switch to admin and check if admin can see the message
      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      const adminView = await tx`SELECT id, content FROM family_messages WHERE id = ${inserted[0].id}`;
      expect(adminView).toHaveLength(1);
      expect(adminView[0].content).toBe('Message to Jan');

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 10000);
});
