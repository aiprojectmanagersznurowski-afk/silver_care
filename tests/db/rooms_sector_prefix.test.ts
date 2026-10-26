import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

/**
 * @REQ: ADM-FACILITY-MANAGE
 *
 * Dane sektorów bez przedrostka „Sektor” (decyzja Michała 2026-10-26). Po migracji nazwy w rooms.sector
 * są takie, jak je pokazujemy. Działa w transakcji i kończy się ROLLBACK.
 */
describe('rooms.sector bez przedrostka (ADM-FACILITY-MANAGE)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('@REQ: ADM-FACILITY-MANAGE - żaden pokój nie ma sektora zaczynającego się od słowa „Sektor”', async () => {
    await sql.begin(async (tx) => {
      const [row] = await tx`SELECT count(*)::int AS n FROM public.rooms WHERE sector ~* '^\\s*sektor(\\s|:|-|$)'`;
      expect(row.n).toBe(0);
      throw new Error('ROLLBACK');
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 20000);
});
