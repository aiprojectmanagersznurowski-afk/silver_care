import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Database Core Decoupled (INT-CORE-DECOUPLED)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('residents table has no provider columns like polar_user_id @REQ: INT-CORE-DECOUPLED', async () => {
    const columns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'residents'
    `;
    const colNames = columns.map(c => c.column_name);
    
    // Core should not contain any provider-specific IDs
    expect(colNames).not.toContain('polar_user_id');
    expect(colNames).not.toContain('provider');
    expect(colNames).not.toContain('withings_id');
  });

  it('external_wearable_links is used for provider mapping @REQ: INT-CORE-DECOUPLED', async () => {
    const columns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'external_wearable_links'
    `;
    const colNames = columns.map(c => c.column_name);
    
    expect(colNames).toContain('provider');
    expect(colNames).toContain('external_user_id');
    expect(colNames).toContain('resident_id');
  });
});
