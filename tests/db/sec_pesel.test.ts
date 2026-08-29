import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Database Security (SEC-PESEL-HASH)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('residents table stores only pesel_hash and never plain text pesel @REQ: SEC-PESEL-HASH', async () => {
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'residents' AND table_schema = 'public'
    `;
    
    const colNames = columns.map(c => c.column_name);
    
    expect(colNames).toContain('pesel_hash');
    expect(colNames).not.toContain('pesel');
  });
});
