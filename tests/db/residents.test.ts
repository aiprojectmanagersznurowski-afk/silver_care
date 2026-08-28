import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// We need a non-prepared connection for Supabase transaction pooler
let sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

describe('Database Residents (ADM-RESIDENT-ADD)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('pesel can only be saved as hash, no raw pesel column exists @REQ: ADM-RESIDENT-ADD', async () => {
    await sql.begin(async (tx) => {
      // Sprawdzamy czy tabela residents nie ma kolumny o nazwie pesel
      const columns = await tx`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'residents' AND column_name = 'pesel'
      `;
      expect(columns.length).toBe(0);

      const hashColumns = await tx`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'residents' AND column_name = 'pesel_hash'
      `;
      expect(hashColumns.length).toBe(1);
    });
  });

  it('prevents double booking of the same bed @REQ: ADM-RESIDENT-ADD', async () => {
    await sql.begin(async (tx) => {
      // Create organization as super_admin
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org') RETURNING id`;
      const orgId = org[0].id;

      // Switch to org_admin
      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}}`}, true)`;

      // Wstawmy testowy pokój i łóżko
      const room = await tx`INSERT INTO rooms (name, organization_id) VALUES ('Pokoj 101', ${orgId}) RETURNING id`;
      const bed = await tx`INSERT INTO beds (room_id, label) VALUES (${room[0].id}, 'Lozko A') RETURNING id`;
      
      const resident1 = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Kowalski', 'hash1') RETURNING id`;
      const resident2 = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Anna', 'Nowak', 'hash2') RETURNING id`;

      // Pierwsze przypisanie
      await tx`INSERT INTO bed_assignments (bed_id, resident_id) VALUES (${bed[0].id}, ${resident1[0].id})`;

      // Drugie przypisanie do tego samego aktywnego łóżka - powinno rzucić wyjątek
      let err;
      await tx`SAVEPOINT test_savepoint`;
      try {
        await tx`INSERT INTO bed_assignments (bed_id, resident_id) VALUES (${bed[0].id}, ${resident2[0].id})`;
      } catch (e) {
        err = e;
        await tx`ROLLBACK TO test_savepoint`;
      }
      expect(err).toBeDefined();
      expect((err as any).message).toMatch(/duplicate key value/);
      
      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 30000);

  it('links a relative with valid roles @REQ: ADM-RESIDENT-ADD', async () => {
    await sql.begin(async (tx) => {
      // Create organization as super_admin
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org') RETURNING id`;
      const orgId = org[0].id;

      // Switch to org_admin
      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}}`}, true)`;
      
      const resident = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Kowalski', 'hash1') RETURNING id`;
      
      // Powiązanie
      const userId = '11111111-1111-1111-1111-111111111111'; // mock user uuid
      await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role) 
               VALUES (${resident[0].id}, ${userId}, 'corka', 'family')`;

      // Zła rola
      let err;
      await tx`SAVEPOINT test_savepoint2`;
      try {
        await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role) 
                 VALUES (${resident[0].id}, ${userId}, 'syn', 'admin')`;
      } catch (e) {
        err = e;
        await tx`ROLLBACK TO test_savepoint2`;
      }
      expect(err).toBeDefined();
      expect((err as any).message).toMatch(/resident_relative_links_role_check/);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 30000);
});
