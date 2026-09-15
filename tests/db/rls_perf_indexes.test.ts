import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

describe('RLS Performance Indexes (SEC-RLS-PERF)', () => {
  let sql: postgres.Sql;

  beforeAll(() => {
    sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
  });

  afterAll(async () => {
    await sql.end();
  });

  it('verifies required RLS optimization composite indexes exist in pg_indexes @REQ: ORG-ISOLATION @REQ: ADM-FACILITY-OCCUPANCY @REQ: REPORT-APPROVAL', async () => {
    const expectedIndexes = [
      'idx_residents_org_archived',
      'idx_daily_reports_resident_status',
      'idx_daily_logs_resident_created',
      'idx_bed_assignments_active',
      'idx_outbox_notifications_pending'
    ];

    const results = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY(${expectedIndexes})
    `;

    const foundIndexNames = results.map(r => r.indexname);
    for (const expected of expectedIndexes) {
      expect(foundIndexNames, `Index ${expected} must exist for RLS performance`).toContain(expected);
    }
  });
});
