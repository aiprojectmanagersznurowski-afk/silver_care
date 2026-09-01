import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Database Bed Assignments (ADM-BED-ASSIGNMENT)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('rejects assigning same resident to multiple beds @REQ: ADM-BED-ASSIGNMENT', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org Assignments') RETURNING id`;
      const orgId = org[0].id;

      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      const room = await tx`INSERT INTO rooms (number, floor, organization_id) VALUES ('Pokoj 101', '1', ${orgId}) RETURNING id`;
      const bed1 = await tx`INSERT INTO beds (room_id, label) VALUES (${room[0].id}, 'Lozko 1') RETURNING id`;
      const bed2 = await tx`INSERT INTO beds (room_id, label) VALUES (${room[0].id}, 'Lozko 2') RETURNING id`;
      
      const resident = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Adam', 'Testowy', 'hash') RETURNING id`;

      // Assign to first bed
      await tx`INSERT INTO bed_assignments (bed_id, resident_id) VALUES (${bed1[0].id}, ${resident[0].id})`;

      // Try assigning to second bed
      let err;
      await tx`SAVEPOINT double_assign_savepoint`;
      try {
        await tx`INSERT INTO bed_assignments (bed_id, resident_id) VALUES (${bed2[0].id}, ${resident[0].id})`;
      } catch (e) {
        err = e;
        await tx`ROLLBACK TO double_assign_savepoint`;
      }
      
      expect(err).toBeDefined();
      expect((err as any).message).toMatch(/duplicate key value/);

      // Verify that after unassigning from first bed, can assign to second
      await tx`UPDATE bed_assignments SET unassigned_at = now() WHERE resident_id = ${resident[0].id}`;
      await tx`INSERT INTO bed_assignments (bed_id, resident_id) VALUES (${bed2[0].id}, ${resident[0].id})`; // Should pass

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 30000);

  it('prevents assignment of archived resident @REQ: ADM-BED-ASSIGNMENT', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org Assignments') RETURNING id`;
      const orgId = org[0].id;

      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      const room = await tx`INSERT INTO rooms (number, floor, organization_id) VALUES ('Pokoj 101', '1', ${orgId}) RETURNING id`;
      const bed = await tx`INSERT INTO beds (room_id, label) VALUES (${room[0].id}, 'Lozko 1') RETURNING id`;
      
      const resident = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Adam', 'Testowy', 'hash') RETURNING id`;
      
      // Archive resident
      await tx`UPDATE residents SET archived_at = now() WHERE id = ${resident[0].id}`;

      // Try assigning
      let err;
      await tx`SAVEPOINT archived_assign_savepoint`;
      try {
        await tx`INSERT INTO bed_assignments (bed_id, resident_id) VALUES (${bed[0].id}, ${resident[0].id})`;
      } catch (e) {
        err = e;
        await tx`ROLLBACK TO archived_assign_savepoint`;
      }
      
      expect(err).toBeDefined();
      expect((err as any).message).toMatch(/Cannot assign bed to an archived resident/);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 30000);

  it('transfers resident between beds atomically using RPC @REQ: ADM-BED-ASSIGNMENT', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org Assignments') RETURNING id`;
      const orgId = org[0].id;

      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      const room = await tx`INSERT INTO rooms (number, floor, organization_id) VALUES ('Pokoj 101', '1', ${orgId}) RETURNING id`;
      const bed1 = await tx`INSERT INTO beds (room_id, label) VALUES (${room[0].id}, 'Lozko 1') RETURNING id`;
      const bed2 = await tx`INSERT INTO beds (room_id, label) VALUES (${room[0].id}, 'Lozko 2') RETURNING id`;
      
      const resident = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Adam', 'Testowy', 'hash') RETURNING id`;
      
      // Initial assignment
      await tx`INSERT INTO bed_assignments (bed_id, resident_id) VALUES (${bed1[0].id}, ${resident[0].id})`;

      // Transfer
      await tx`SELECT public.transfer_resident_bed(${resident[0].id}, ${bed2[0].id})`;

      // Verify history
      const assignments = await tx`SELECT bed_id, unassigned_at FROM bed_assignments WHERE resident_id = ${resident[0].id} ORDER BY assigned_at ASC`;
      
      expect(assignments.length).toBe(2);
      
      // First assignment should be unassigned
      expect(assignments[0].bed_id).toBe(bed1[0].id);
      expect(assignments[0].unassigned_at).not.toBeNull();

      // Second assignment should be active
      expect(assignments[1].bed_id).toBe(bed2[0].id);
      expect(assignments[1].unassigned_at).toBeNull();

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 30000);
});
