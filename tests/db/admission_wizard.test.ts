import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

describe('Atomic Resident Admission With Bed (ADM-RESIDENT-WIZARD)', () => {
  let sql: postgres.Sql;

  beforeAll(() => {
    sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
  });

  afterAll(async () => {
    await sql.end();
  });

  it('admits resident and assigns bed atomically in one call @REQ: ADM-RESIDENT-ADD @REQ: ADM-BED-ASSIGNMENT', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;

      const org = await tx`INSERT INTO organizations (name) VALUES ('Admission Test Org') RETURNING id`;
      const orgId = org[0].id;

      const room = await tx`INSERT INTO rooms (organization_id, number, floor) VALUES (${orgId}, '101', '1') RETURNING id`;
      const bed = await tx`INSERT INTO beds (room_id, label) VALUES (${room[0].id}, '1') RETURNING id`;
      const bedId = bed[0].id;

      const adminId = '91919191-9191-9191-9191-919191919191';

      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
        sub: adminId,
        app_metadata: { role: 'org_admin', organization_id: orgId },
        aal: 'aal2'
      })}, true)`;

      // Call atomic admit_resident_with_bed
      const result = await tx`
        SELECT public.admit_resident_with_bed(
          'Stanisław',
          'Kowalski',
          'hash_stanislaw_1',
          'encrypted_stanislaw_1',
          'M',
          '1945-05-10'::date,
          'walking',
          false,
          ${bedId},
          'Nowy pensjonariusz'
        ) as res
      `;

      const admitted = result[0].res;
      expect(admitted.status).toBe('admitted');
      expect(admitted.resident_id).toBeDefined();
      expect(admitted.bed_assignment_id).toBeDefined();

      // Verify resident in DB
      const residents = await tx`SELECT * FROM public.residents WHERE id = ${admitted.resident_id}`;
      expect(residents.length).toBe(1);
      expect(residents[0].first_name).toBe('Stanisław');
      expect(residents[0].gender).toBe('M');

      // Verify active bed assignment
      const assignments = await tx`SELECT * FROM public.bed_assignments WHERE resident_id = ${admitted.resident_id} AND unassigned_at IS NULL`;
      expect(assignments.length).toBe(1);
      expect(assignments[0].bed_id).toBe(bedId);

      // Verify audit_logs under postgres role
      await tx`SET LOCAL ROLE postgres`;
      const audit = await tx`SELECT * FROM public.audit_logs WHERE performed_by = ${adminId} AND action = 'resident_admitted'`;
      expect(audit.length).toBe(1);
      expect(audit[0].payload.resident_id).toBe(admitted.resident_id);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });

  it('rolls back atomic admission if bed is already occupied @REQ: ADM-BED-ASSIGNMENT', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;

      const org = await tx`INSERT INTO organizations (name) VALUES ('Conflict Org') RETURNING id`;
      const orgId = org[0].id;

      const room = await tx`INSERT INTO rooms (organization_id, number, floor) VALUES (${orgId}, '201', '2') RETURNING id`;
      const bed = await tx`INSERT INTO beds (room_id, label) VALUES (${room[0].id}, '1') RETURNING id`;
      const bedId = bed[0].id;

      // Existing occupant
      const res1 = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash, gender, care_level) VALUES (${orgId}, 'Adam', 'Occupant', 'hash_occ', 'M', 'walking') RETURNING id`;
      await tx`INSERT INTO bed_assignments (bed_id, resident_id) VALUES (${bedId}, ${res1[0].id})`;

      const adminId = '92929292-9292-9292-9292-929292929292';

      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
        sub: adminId,
        app_metadata: { role: 'org_admin', organization_id: orgId },
        aal: 'aal2'
      })}, true)`;

      let blocked = false;
      let savepointErr;
      await tx`SAVEPOINT sp_bed_collision`;
      try {
        await tx`
          SELECT public.admit_resident_with_bed(
            'Zofia',
            'Nowa',
            'hash_zofia_new',
            'encrypted_zofia_new',
            'F',
            '1950-01-01'::date,
            'sitting',
            false,
            ${bedId},
            'Próba zajęcia zajętego łóżka'
          )
        `;
      } catch (err: any) {
        blocked = true;
        savepointErr = err;
        await tx`ROLLBACK TO sp_bed_collision`;
      }

      expect(blocked).toBe(true);
      expect(savepointErr.message).toMatch(/is already occupied/);

      // Verify Zofia was NOT admitted due to rollback
      const checkZofia = await tx`SELECT * FROM public.residents WHERE pesel_hash = 'hash_zofia_new'`;
      expect(checkZofia.length).toBe(0);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
