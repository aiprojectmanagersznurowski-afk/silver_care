import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

/**
 * @REQ: ADM-CAPACITY-LIMIT
 *
 * SC-ADM-22/AC5: podsumowanie placówek dla super admina zwraca liczbę aktywnych łóżek, liczbę podopiecznych
 * przebywających w placówce (bez zarchiwizowanych, zmarłych i z zakończoną umową — decyzja Michała 2026-10-29)
 * oraz znacznik przekroczenia limitu miejsc (łóżka albo podopieczni ponad limit).
 * Test w transakcji zakończonej ROLLBACK.
 */
describe('Podsumowanie placówek z limitem miejsc (ADM-CAPACITY-LIMIT)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('@REQ: ADM-CAPACITY-LIMIT - łóżka, podopieczni przebywający i znacznik ponad limit w podsumowaniu super admina', async () => {
    await sql.begin(async (tx) => {
      const [over] = await tx`INSERT INTO organizations (name, resident_limit) VALUES ('Placowka Ponad Limit', 2) RETURNING id`;
      const [under] = await tx`INSERT INTO organizations (name, resident_limit) VALUES ('Placowka W Limicie', 10) RETURNING id`;

      await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES
        (${over.id}, 'A', 'Obecna', 'h-cap-1'), (${over.id}, 'B', 'Obecna', 'h-cap-2')`;
      await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash, death_date) VALUES (${over.id}, 'C', 'Zmarla', 'h-cap-3', '2026-10-01')`;
      await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash, archived_at) VALUES (${over.id}, 'D', 'Archiwum', 'h-cap-4', now())`;
      await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash, contract_end_date) VALUES (${over.id}, 'E', 'Wypisana', 'h-cap-5', '2026-10-01')`;

      const [room] = await tx`INSERT INTO rooms (organization_id, number, floor) VALUES (${over.id}, 'CAP-1', '1') RETURNING id`;
      await tx`INSERT INTO beds (room_id, label, is_active) VALUES (${room.id}, 'A', true), (${room.id}, 'B', true), (${room.id}, 'C', true), (${room.id}, 'D', false)`;

      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      const rows = await tx`SELECT * FROM public.get_superadmin_organization_summary() WHERE organization_id IN (${over.id}, ${under.id})`;
      const byId = Object.fromEntries(rows.map((r) => [r.organization_id, r]));

      expect(Number(byId[over.id].active_resident_count)).toBe(2);
      expect(Number(byId[over.id].active_bed_count)).toBe(3);
      expect(byId[over.id].over_capacity_limit).toBe(true);
      expect(Number(byId[under.id].active_bed_count)).toBe(0);
      expect(byId[under.id].over_capacity_limit).toBe(false);

      throw new Error('ROLLBACK');
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 30000);
});
