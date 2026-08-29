import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Database Resident Archive (ADM-ARCHIVE)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('prevents editing after archive, blocks ingest, and handles hard delete @REQ: ADM-ARCHIVE', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org Archive') RETURNING id`;
      const orgId = org[0].id;

      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      const resident = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Kowalski', 'hash_arch') RETURNING id`;
      
      // Insert audit log manually for testing hard delete
      await tx`INSERT INTO audit_logs (organization_id, resident_id, action, payload) VALUES (${orgId}, ${resident[0].id}, 'CREATE_RESIDENT', '{"foo": "bar"}'::jsonb)`;

      // Archive resident
      await tx`UPDATE residents SET archived_at = now() WHERE id = ${resident[0].id}`;

      // 1. Personel zachowuje wyłącznie odczyt (cannot edit first_name)
      let err1;
      await tx`SAVEPOINT edit_savepoint`;
      try {
        await tx`UPDATE residents SET first_name = 'Zmieniony' WHERE id = ${resident[0].id}`;
      } catch (e) {
        err1 = e;
        await tx`ROLLBACK TO edit_savepoint`;
      }
      expect(err1).toBeDefined();
      expect((err1 as any).message).toMatch(/Cannot edit an archived resident/);

      // 2. Ingest odrzuca nowe dane dla zarchiwizowanego pensjonariusza
      let err2;
      await tx`SAVEPOINT ingest_savepoint`;
      try {
        await tx`INSERT INTO physiological_data_ingest (organization_id, resident_id, metric, value) VALUES (${orgId}, ${resident[0].id}, 'heart_rate', 70)`;
      } catch (e) {
        err2 = e;
        await tx`ROLLBACK TO ingest_savepoint`;
      }
      expect(err2).toBeDefined();
      expect((err2 as any).message).toMatch(/new row violates row-level security policy for table "physiological_data_ingest"/);

      // 3. Twarde usunięcie redaguje dane w audit_logs zamiast kasować wpisy
      await tx`SELECT public.hard_delete_resident(${resident[0].id})`;
      
      // Resident is gone
      const resCount = await tx`SELECT count(*) FROM residents WHERE id = ${resident[0].id}`;
      expect(Number(resCount[0].count)).toBe(0);

      // Audit log remains and is redacted
      const logs = await tx`SELECT * FROM audit_logs WHERE resident_id = ${resident[0].id}`;
      expect(logs.length).toBe(1);
      expect(logs[0].payload.redacted).toBe(true);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 30000);
});
