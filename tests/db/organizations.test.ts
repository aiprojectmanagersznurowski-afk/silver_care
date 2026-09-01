import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// @REQ: ORG-ISOLATION
// Load env vars
dotenv.config({ path: resolve(__dirname, '../../.env.local') });

describe('Database RLS: organizations (ORG-ISOLATION)', () => {
  let sql: postgres.Sql;

  beforeAll(async () => {
    // connect with superuser direct string to set up test environment if needed
    sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
    // Clean up any dirty state from connection pooler
    await sql`RESET ROLE`;
    await sql`RESET ALL`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('fails to fetch organizations without authentication', async () => {
    // Attempting query as authenticated user but without JWT context
    await sql.begin(async (tx) => {
      await tx`RESET ROLE`;
      // Supabase sets role to authenticated for logged in users
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SET LOCAL request.jwt.claims TO '{"sub": "00000000-0000-0000-0000-000000000000"}'`;
      const result = await tx`SELECT * FROM organizations`;
      expect(result.length).toBe(0);
    });
  });

  it('restricts organization visibility to the one assigned in JWT', async () => {
    await sql.begin(async (tx) => {
      await tx`RESET ROLE`;
      // Create fake organizations for test if needed or assume existence
      const orgIdA = crypto.randomUUID();
      const orgIdB = crypto.randomUUID();
      
      // Inject some fake orgs using postgres superuser (assuming we have organizations table)
      await tx`INSERT INTO organizations (id, name) VALUES (${orgIdA}, 'Org A'), (${orgIdB}, 'Org B')`;
      
      // Switch to authenticated role
      await tx`SET LOCAL ROLE authenticated`;
      // Set JWT claims with organization_id A
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ app_metadata: { organization_id: orgIdA } })}, true)`;

      const result = await tx`SELECT * FROM organizations`;
      
      // Should see ONLY Org A
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(orgIdA);
      
      // Cleanup happens via transaction rollback at the end of tx, but we can't rollback automatically in postgres.js begin() unless it throws.
      // We will throw to ensure it rolls back.
      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });

  it('inherits organization_id from token on insert', async () => {
    await sql.begin(async (tx) => {
      await tx`RESET ROLE`;
      const orgIdA = crypto.randomUUID();
      
      // Insert initial org as superuser
      await tx`INSERT INTO organizations (id, name) VALUES (${orgIdA}, 'Org A')`;
      
      // Now set role and insert some dummy record that belongs to organization
      // Wait, we need another table to test inheritance, OR the organization table itself doesn't inherit, 
      // but the requirement says: "Nowy rekord dziedziczy organization_id z tokenu". Let's test this on a dummy table `rooms` 
      // or we can test it on the organizations table itself? Organizations themselves are isolated? No, they define the boundary.
      // Let's assume there is a `rooms` table for `ADM-FACILITY-MANAGE`.
      // But for ORG-ISOLATION we can test inserting into any table, or just test the function `get_jwt_organization_id()`.
      
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ app_metadata: { organization_id: orgIdA } })}, true)`;

      // Try to insert a room without explicitly providing organization_id
      const [room] = await tx`INSERT INTO rooms (number, floor) VALUES ('Room 101', '1') RETURNING *`;
      
      expect(room.organization_id).toBe(orgIdA);
      
      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
