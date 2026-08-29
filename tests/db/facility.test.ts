import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Database Facility Management (ADM-FACILITY-MANAGE)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('rejects duplicate room names in the same organization @REQ: ADM-FACILITY-MANAGE', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org Facility') RETURNING id`;
      const orgId = org[0].id;

      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}}`}, true)`;

      await tx`INSERT INTO rooms (name, organization_id) VALUES ('Pokoj 1', ${orgId})`;

      let err;
      await tx`SAVEPOINT room_savepoint`;
      try {
        await tx`INSERT INTO rooms (name, organization_id) VALUES ('Pokoj 1', ${orgId})`;
      } catch (e) {
        err = e;
        await tx`ROLLBACK TO room_savepoint`;
      }
      
      expect(err).toBeDefined();
      expect((err as any).message).toMatch(/duplicate key value/);

      // Check different org can have same room name
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}}', true)`;
      const org2 = await tx`INSERT INTO organizations (name) VALUES ('Other Org') RETURNING id`;
      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${org2[0].id}"}}`}, true)`;
      
      // Should not throw
      await tx`INSERT INTO rooms (name, organization_id) VALUES ('Pokoj 1', ${org2[0].id})`;

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 30000);

  it('rejects duplicate bed labels in the same room @REQ: ADM-FACILITY-MANAGE', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org') RETURNING id`;
      const orgId = org[0].id;

      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}}`}, true)`;
      const room = await tx`INSERT INTO rooms (name, organization_id) VALUES ('Pokoj 2', ${orgId}) RETURNING id`;

      await tx`INSERT INTO beds (room_id, label) VALUES (${room[0].id}, 'Lozko A')`;

      let err;
      await tx`SAVEPOINT bed_savepoint`;
      try {
        await tx`INSERT INTO beds (room_id, label) VALUES (${room[0].id}, 'Lozko A')`;
      } catch (e) {
        err = e;
        await tx`ROLLBACK TO bed_savepoint`;
      }
      
      expect(err).toBeDefined();
      expect((err as any).message).toMatch(/duplicate key value/);

      // Different room, same label is allowed
      const room2 = await tx`INSERT INTO rooms (name, organization_id) VALUES ('Pokoj 3', ${orgId}) RETURNING id`;
      await tx`INSERT INTO beds (room_id, label) VALUES (${room2[0].id}, 'Lozko A')`;

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 30000);

  it('prevents deactivation of a bed with an active assignment @REQ: ADM-FACILITY-MANAGE', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org') RETURNING id`;
      const orgId = org[0].id;

      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}}`}, true)`;
      const room = await tx`INSERT INTO rooms (name, organization_id) VALUES ('Pokoj', ${orgId}) RETURNING id`;
      const bed = await tx`INSERT INTO beds (room_id, label) VALUES (${room[0].id}, 'Lozko A') RETURNING id`;
      
      const resident = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'K', 'h') RETURNING id`;
      await tx`INSERT INTO bed_assignments (bed_id, resident_id) VALUES (${bed[0].id}, ${resident[0].id})`;

      let err;
      await tx`SAVEPOINT deactivate_savepoint`;
      try {
        await tx`UPDATE beds SET deactivated_at = now() WHERE id = ${bed[0].id}`;
      } catch (e) {
        err = e;
        await tx`ROLLBACK TO deactivate_savepoint`;
      }
      
      expect(err).toBeDefined();
      expect((err as any).message).toMatch(/Cannot deactivate bed with active assignment/i);

      // Verify closing the assignment allows deactivation
      await tx`UPDATE bed_assignments SET unassigned_at = now() WHERE bed_id = ${bed[0].id}`;
      await tx`UPDATE beds SET deactivated_at = now() WHERE id = ${bed[0].id}`; // should succeed now

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 30000);

  it('computes bed_count correctly without manual updates @REQ: ADM-FACILITY-MANAGE', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org') RETURNING id`;
      const orgId = org[0].id;

      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}}`}, true)`;
      const room = await tx`INSERT INTO rooms (name, organization_id) VALUES ('Pokoj', ${orgId}) RETURNING id`;
      
      let res = await tx`SELECT id, name, bed_count(rooms) FROM rooms WHERE id = ${room[0].id}`;
      expect(res[0].bed_count).toBe(0);

      const bed1 = await tx`INSERT INTO beds (room_id, label) VALUES (${room[0].id}, 'Lozko 1') RETURNING id`;
      const bed2 = await tx`INSERT INTO beds (room_id, label) VALUES (${room[0].id}, 'Lozko 2') RETURNING id`;

      res = await tx`SELECT bed_count(rooms) FROM rooms WHERE id = ${room[0].id}`;
      expect(res[0].bed_count).toBe(2);

      // Deactivated beds should still count as beds? 
      // The requirement doesn't explicitly state whether deactivated beds subtract from bed_count.
      // We assume bed_count is all beds that are NOT deactivated.
      await tx`UPDATE beds SET deactivated_at = now() WHERE id = ${bed1[0].id}`;
      res = await tx`SELECT bed_count(rooms) FROM rooms WHERE id = ${room[0].id}`;
      expect(res[0].bed_count).toBe(1);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 30000);
});
