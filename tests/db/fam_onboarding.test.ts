import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('Database Family Onboarding Flow (FAM-ONBOARDING, CONSENT-GRANTOR)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('completes onboarding for legal_guardian with consent ledger registration @REQ: FAM-ONBOARDING', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;

      // 1. Setup org & resident
      const org = await tx`INSERT INTO organizations (name) VALUES ('Onboarding Test Org') RETURNING id`;
      const orgId = org[0].id;

      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) 
                           VALUES (${orgId}, 'Stanisław', 'Nowak', 'pesel_hash_onb_1') RETURNING id`;
      const residentId = res[0].id;

      // 2. Create invitation with role 'legal_guardian'
      const invite = await tx`INSERT INTO resident_invitations (organization_id, resident_id, role, email) 
                              VALUES (${orgId}, ${residentId}, 'legal_guardian', 'guardian@example.com') 
                              RETURNING id, expires_at, claimed_at, revoked_at, role`;
      const inviteId = invite[0].id;
      expect(invite[0].role).toBe('legal_guardian');
      expect(invite[0].claimed_at).toBeNull();

      // 3. Simulate registration: mark invitation as claimed
      const updated = await tx`UPDATE resident_invitations 
                               SET claimed_at = now() 
                               WHERE id = ${inviteId} AND claimed_at IS NULL AND revoked_at IS NULL AND expires_at > now()
                               RETURNING id, claimed_at`;
      expect(updated.length).toBe(1);
      expect(updated[0].claimed_at).not.toBeNull();

      // 4. Create relative link with role 'legal_guardian'
      const fakeUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const link = await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role)
                            VALUES (${residentId}, ${fakeUserId}, 'legal_guardian', 'legal_guardian')
                            RETURNING id, role, relationship_code`;
      expect(link[0].role).toBe('legal_guardian');

      // 5. Legal guardian grants Art. 9 consent in consent_ledger
      const consent1 = await tx`INSERT INTO consent_ledger (organization_id, resident_id, purpose, granted_by)
                               VALUES (${orgId}, ${residentId}, 'wellness_data_ingest', 'legal_guardian')
                               RETURNING id, purpose, granted_by`;
      expect(consent1[0].purpose).toBe('wellness_data_ingest');
      expect(consent1[0].granted_by).toBe('legal_guardian');

      const consent2 = await tx`INSERT INTO consent_ledger (organization_id, resident_id, purpose, granted_by)
                               VALUES (${orgId}, ${residentId}, 'family_view_basic', 'legal_guardian')
                               RETURNING id, purpose, granted_by`;
      expect(consent2[0].purpose).toBe('family_view_basic');

      // 6. Audit log without PII
      const audit = await tx`INSERT INTO audit_logs (organization_id, resident_id, action, payload)
                             VALUES (${orgId}, ${residentId}, 'FAMILY_ACCOUNT_ACTIVATED', 
                                     jsonb_build_object('role', 'legal_guardian', 'user_id', ${fakeUserId}::text))
                             RETURNING id, action`;
      expect(audit[0].action).toBe('FAMILY_ACCOUNT_ACTIVATED');

      throw new Error('ROLLBACK');
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });

  it('completes onboarding for regular family without Art. 9 consent privileges @REQ: FAM-ONBOARDING', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;

      const org = await tx`INSERT INTO organizations (name) VALUES ('Family Org') RETURNING id`;
      const orgId = org[0].id;

      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) 
                           VALUES (${orgId}, 'Maria', 'Kowalska', 'pesel_hash_onb_2') RETURNING id`;
      const residentId = res[0].id;

      // Create invitation with role 'family'
      const invite = await tx`INSERT INTO resident_invitations (organization_id, resident_id, role, email) 
                              VALUES (${orgId}, ${residentId}, 'family', 'corka@example.com') 
                              RETURNING id, role`;
      const inviteId = invite[0].id;
      expect(invite[0].role).toBe('family');

      // Claim invitation
      await tx`UPDATE resident_invitations SET claimed_at = now() WHERE id = ${inviteId}`;

      const fakeUserId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      const link = await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role)
                            VALUES (${residentId}, ${fakeUserId}, 'family', 'family')
                            RETURNING id, role`;
      expect(link[0].role).toBe('family');

      // Attempting to grant consent as 'family' MUST FAIL by DB constraint
      await expect(
        tx`INSERT INTO consent_ledger (organization_id, resident_id, purpose, granted_by)
           VALUES (${orgId}, ${residentId}, 'wellness_data_ingest', 'family')`
      ).rejects.toThrow(/valid_grantor/);

      throw new Error('ROLLBACK');
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });

  it('blocks claiming expired or revoked invitations @REQ: FAM-ONBOARDING', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;

      const org = await tx`INSERT INTO organizations (name) VALUES ('Blocked Org') RETURNING id`;
      const orgId = org[0].id;

      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) 
                           VALUES (${orgId}, 'Anna', 'Wisniewska', 'pesel_hash_onb_3') RETURNING id`;
      const residentId = res[0].id;

      // 1. Expired invitation
      const expiredInvite = await tx`INSERT INTO resident_invitations (organization_id, resident_id, role, email, expires_at) 
                                     VALUES (${orgId}, ${residentId}, 'family', 'exp@example.com', now() - interval '1 hour') 
                                     RETURNING id`;
      const claimExpired = await tx`UPDATE resident_invitations 
                                    SET claimed_at = now() 
                                    WHERE id = ${expiredInvite[0].id} 
                                    AND claimed_at IS NULL 
                                    AND revoked_at IS NULL 
                                    AND expires_at > now()
                                    RETURNING id`;
      expect(claimExpired.length).toBe(0);

      // 2. Revoked invitation
      const revokedInvite = await tx`INSERT INTO resident_invitations (organization_id, resident_id, role, email, revoked_at) 
                                     VALUES (${orgId}, ${residentId}, 'family', 'rev@example.com', now() - interval '10 minutes') 
                                     RETURNING id`;
      const claimRevoked = await tx`UPDATE resident_invitations 
                                    SET claimed_at = now() 
                                    WHERE id = ${revokedInvite[0].id} 
                                    AND claimed_at IS NULL 
                                    AND revoked_at IS NULL 
                                    AND expires_at > now()
                                    RETURNING id`;
      expect(claimRevoked.length).toBe(0);

      throw new Error('ROLLBACK');
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
