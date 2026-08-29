import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Database Facility Occupancy (ADM-FACILITY-OCCUPANCY)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('computes free_beds and occupied_beds correctly instantly @REQ: ADM-FACILITY-OCCUPANCY', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org Occupancy') RETURNING id`;
      const orgId = org[0].id;

      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}}`}, true)`;
      const room = await tx`INSERT INTO rooms (name, organization_id) VALUES ('Pokoj 201', ${orgId}) RETURNING id`;
      
      const bed1 = await tx`INSERT INTO beds (room_id, label) VALUES (${room[0].id}, 'Lozko 1') RETURNING id`;
      const bed2 = await tx`INSERT INTO beds (room_id, label) VALUES (${room[0].id}, 'Lozko 2') RETURNING id`;
      
      const resident = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Kowalski', 'hash1') RETURNING id`;

      // 1. Initially bed_count=2, occupied=0, free=2
      let result = await tx`SELECT public.bed_count(r) as b, public.occupied_beds(r) as o, public.free_beds(r) as f FROM rooms r WHERE id = ${room[0].id}`;
      expect(Number(result[0].b)).toBe(2);
      expect(Number(result[0].o)).toBe(0);
      expect(Number(result[0].f)).toBe(2);

      // 2. Assign resident to bed 1 -> bed_count=2, occupied=1, free=1
      await tx`INSERT INTO bed_assignments (bed_id, resident_id) VALUES (${bed1[0].id}, ${resident[0].id})`;
      result = await tx`SELECT public.bed_count(r) as b, public.occupied_beds(r) as o, public.free_beds(r) as f FROM rooms r WHERE id = ${room[0].id}`;
      expect(Number(result[0].b)).toBe(2);
      expect(Number(result[0].o)).toBe(1);
      expect(Number(result[0].f)).toBe(1);

      // 3. Transfer resident to bed 2 -> bed_count=2, occupied=1, free=1
      await tx`SELECT public.transfer_resident_bed(${resident[0].id}, ${bed2[0].id})`;
      result = await tx`SELECT public.bed_count(r) as b, public.occupied_beds(r) as o, public.free_beds(r) as f FROM rooms r WHERE id = ${room[0].id}`;
      expect(Number(result[0].b)).toBe(2);
      expect(Number(result[0].o)).toBe(1);
      expect(Number(result[0].f)).toBe(1);

      // 4. Deactivate the empty bed (bed1) -> bed_count=1, occupied=1, free=0
      await tx`UPDATE beds SET deactivated_at = now() WHERE id = ${bed1[0].id}`;
      result = await tx`SELECT public.bed_count(r) as b, public.occupied_beds(r) as o, public.free_beds(r) as f FROM rooms r WHERE id = ${room[0].id}`;
      expect(Number(result[0].b)).toBe(1);
      expect(Number(result[0].o)).toBe(1);
      expect(Number(result[0].f)).toBe(0);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 30000);
});
