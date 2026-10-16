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

  it('allows family and legal_guardian to insert messages only for linked residents and prevents updates @REQ: FAM-MESSAGES', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org Messages') RETURNING id`;
      const orgId = org[0].id;

      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      
      const res1 = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Kowalski', 'hash-1') RETURNING id`;
      const res2 = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Adam', 'Nowak', 'hash-2') RETURNING id`;

      const familyUid = '33333333-3333-3333-3333-333333333333';
      const guardianUid = '55555555-5555-5555-5555-555555555555';

      // 1. Link familyUid to res1 (role: 'family') and guardianUid to res2 (role: 'legal_guardian')
      await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role) VALUES (${res1[0].id}, ${familyUid}, 'SON', 'family')`;
      await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role) VALUES (${res2[0].id}, ${guardianUid}, 'GUARDIAN', 'legal_guardian')`;

      // 2. Switch to family user
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${familyUid}", "app_metadata": {"role": "family", "organization_id": "${orgId}"}, "aal": "aal1"}`}, true)`;

      // Should succeed for res1
      const insertedFamily = await tx`INSERT INTO family_messages (organization_id, resident_id, relative_user_id, content) VALUES (${orgId}, ${res1[0].id}, ${familyUid}, 'Message to Jan') RETURNING id`;
      expect(insertedFamily).toHaveLength(1);

      // Select should see res1 message
      const familySelect = await tx`SELECT id, content FROM family_messages WHERE relative_user_id = ${familyUid}`;
      expect(familySelect).toHaveLength(1);

      // Should fail for res2 (not linked to family user)
      let errFamilyRes2 = null;
      try {
        await tx.savepoint(async (sp) => {
          await sp`INSERT INTO family_messages (organization_id, resident_id, relative_user_id, content) VALUES (${orgId}, ${res2[0].id}, ${familyUid}, 'Message to Adam')`;
        });
      } catch (e) { errFamilyRes2 = e; }
      expect(errFamilyRes2).not.toBeNull();

      // Should fail to UPDATE message (immutable / append-only: 0 rows updated)
      const updateResult = await tx`UPDATE family_messages SET content = 'Hacked' WHERE id = ${insertedFamily[0].id}`;
      expect(updateResult.count).toBe(0);

      // 3. Switch to legal_guardian user
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${guardianUid}", "app_metadata": {"role": "legal_guardian", "organization_id": "${orgId}"}, "aal": "aal1"}`}, true)`;

      // Should succeed for res2 (linked to guardian)
      const insertedGuardian = await tx`INSERT INTO family_messages (organization_id, resident_id, relative_user_id, content) VALUES (${orgId}, ${res2[0].id}, ${guardianUid}, 'Message from Guardian') RETURNING id`;
      expect(insertedGuardian).toHaveLength(1);

      // Select as guardian should see res2 message and NOT see family message
      const guardianSelect = await tx`SELECT id, content FROM family_messages WHERE relative_user_id = ${guardianUid}`;
      expect(guardianSelect).toHaveLength(1);
      expect(guardianSelect[0].content).toBe('Message from Guardian');

      // Guardian should fail to insert for res1 (not linked)
      let errGuardianRes1 = null;
      try {
        await tx.savepoint(async (sp) => {
          await sp`INSERT INTO family_messages (organization_id, resident_id, relative_user_id, content) VALUES (${orgId}, ${res1[0].id}, ${guardianUid}, 'Message to Jan from Guardian')`;
        });
      } catch (e) { errGuardianRes1 = e; }
      expect(errGuardianRes1).not.toBeNull();

      // 4. Switch to org_admin and verify admin can see both messages
      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      const adminView = await tx`SELECT id, content FROM family_messages WHERE organization_id = ${orgId} ORDER BY created_at ASC`;
      expect(adminView).toHaveLength(2);
      expect(adminView.map(m => m.content)).toEqual(['Message to Jan', 'Message from Guardian']);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 10000);
});
