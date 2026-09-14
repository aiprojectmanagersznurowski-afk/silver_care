import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

let sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

describe('RLS Hardening & Tenant Isolation (MIG-RLS-HARDENING)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('super_admin has full CRUD on organizations while org_admin cannot insert/delete @REQ: ORG-ISOLATION', async () => {
    await sql.begin(async (tx) => {
      // 1. As super_admin: create Organization A and Organization B
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;

      const [orgA] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Sloneczna') RETURNING id, name`;
      const [orgB] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Ksiezycowa') RETURNING id, name`;

      expect(orgA.id).toBeDefined();
      expect(orgB.id).toBeDefined();

      // super_admin sees both
      const allOrgs = await tx`SELECT * FROM organizations WHERE id IN (${orgA.id}, ${orgB.id})`;
      expect(allOrgs.length).toBe(2);

      // super_admin updates orgA
      const [updatedA] = await tx`UPDATE organizations SET name = 'Placowka Sloneczna Premium' WHERE id = ${orgA.id} RETURNING name`;
      expect(updatedA.name).toBe('Placowka Sloneczna Premium');

      // 2. Switch to org_admin of Org A
      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgA.id}"}, "aal": "aal2"}`}, true)`;

      // org_admin sees Org A
      const orgASeen = await tx`SELECT * FROM organizations WHERE id = ${orgA.id}`;
      expect(orgASeen.length).toBe(1);

      // org_admin does NOT see Org B (isolated)
      const orgBSeen = await tx`SELECT * FROM organizations WHERE id = ${orgB.id}`;
      expect(orgBSeen.length).toBe(0);

      // org_admin can update Org A
      const [adminUpdatedA] = await tx`UPDATE organizations SET name = 'Placowka Sloneczna VIP' WHERE id = ${orgA.id} RETURNING name`;
      expect(adminUpdatedA.name).toBe('Placowka Sloneczna VIP');

      // org_admin CANNOT update Org B (0 rows updated)
      const adminUpdateB = await tx`UPDATE organizations SET name = 'Hacked Name' WHERE id = ${orgB.id} RETURNING id`;
      expect(adminUpdateB.length).toBe(0);

      // org_admin CANNOT insert organization
      let insertErr: any;
      try {
        await tx.savepoint(async (sp) => {
          await sp`INSERT INTO organizations (name) VALUES ('Unauthorized Org')`;
        });
      } catch (e) {
        insertErr = e;
      }
      expect(insertErr).toBeDefined();

      // org_admin CANNOT delete Org A
      const adminDelete = await tx`DELETE FROM organizations WHERE id = ${orgA.id} RETURNING id`;
      expect(adminDelete.length).toBe(0);

      // 3. Switch back to super_admin and delete Org B
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      const [deletedB] = await tx`DELETE FROM organizations WHERE id = ${orgB.id} RETURNING id`;
      expect(deletedB.id).toBe(orgB.id);

      throw new Error('ROLLBACK');
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });

  it('enforces multi-tenant data isolation between Org A and Org B for residents and PoLP for super_admin @REQ: ORG-ISOLATION', async () => {
    await sql.begin(async (tx) => {
      // 1. Setup organizations and residents as postgres
      await tx`SET LOCAL ROLE postgres`;
      const [orgA] = await tx`INSERT INTO organizations (name) VALUES ('Org Alpha') RETURNING id`;
      const [orgB] = await tx`INSERT INTO organizations (name) VALUES ('Org Beta') RETURNING id`;

      const [resA] = await tx`
        INSERT INTO residents (organization_id, first_name, last_name, pesel_hash)
        VALUES (${orgA.id}, 'Jan', 'Alpha', 'hashAlpha')
        RETURNING id
      `;

      const [resB] = await tx`
        INSERT INTO residents (organization_id, first_name, last_name, pesel_hash)
        VALUES (${orgB.id}, 'Katarzyna', 'Beta', 'hashBeta')
        RETURNING id
      `;

      // 2. org_admin of Org A tries to query residents
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgA.id}"}, "aal": "aal2"}`}, true)`;

      const alphaResidents = await tx`SELECT * FROM residents`;
      expect(alphaResidents.length).toBe(1);
      expect(alphaResidents[0].id).toBe(resA.id);

      const crossResidentQuery = await tx`SELECT * FROM residents WHERE id = ${resB.id}`;
      expect(crossResidentQuery.length).toBe(0);

      // 3. nurse of Org A tries to query residents
      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "nurse", "organization_id": "${orgA.id}"}, "aal": "aal2"}`}, true)`;
      const nurseCrossQuery = await tx`SELECT * FROM residents WHERE id = ${resB.id}`;
      expect(nurseCrossQuery.length).toBe(0);

      // 4. super_admin without organization_id cannot read residents (PoLP: Zero-Access to sensitive resident data)
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      const superAdminResidents = await tx`SELECT * FROM residents WHERE id IN (${resA.id}, ${resB.id})`;
      expect(superAdminResidents.length).toBe(0);

      throw new Error('ROLLBACK');
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
