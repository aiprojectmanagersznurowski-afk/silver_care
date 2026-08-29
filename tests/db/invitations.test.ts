import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Database Resident Invitations (ADM-INVITE)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('sets expires_at to 7 days and handles revocation correctly @REQ: ADM-INVITE', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      const org = await tx`INSERT INTO organizations (name) VALUES ('Test Org Invite') RETURNING id`;
      const orgId = org[0].id;

      await tx`SELECT set_config('request.jwt.claims', ${`{"app_metadata": {"role": "org_admin", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      const resident = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Kowalski', 'hash_inv') RETURNING id`;

      // 1. Insert invitation
      const invite = await tx`INSERT INTO resident_invitations (resident_id, role) VALUES (${resident[0].id}, 'family') RETURNING id, expires_at, created_at, revoked_at`;
      
      const createdAt = new Date(invite[0].created_at).getTime();
      const expiresAt = new Date(invite[0].expires_at).getTime();
      const diffDays = Math.round((expiresAt - createdAt) / (1000 * 60 * 60 * 24));
      
      expect(diffDays).toBe(7);
      expect(invite[0].revoked_at).toBeNull();

      // 2. Try to tamper with resident_id
      const otherResident = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Adam', 'Nowak', 'hash2') RETURNING id`;
      
      let err;
      await tx`SAVEPOINT tamper_savepoint`;
      try {
        await tx`UPDATE resident_invitations SET resident_id = ${otherResident[0].id} WHERE id = ${invite[0].id}`;
      } catch (e) {
        err = e;
        await tx`ROLLBACK TO tamper_savepoint`;
      }
      
      expect(err).toBeDefined();
      expect((err as any).message).toMatch(/Only revoked_at and claimed_at can be updated/);

      // 3. Revoke invitation using RPC
      await tx`SELECT public.revoke_invitation(${invite[0].id})`;
      const revoked = await tx`SELECT revoked_at FROM resident_invitations WHERE id = ${invite[0].id}`;
      expect(revoked[0].revoked_at).not.toBeNull();

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  }, 30000);
});
