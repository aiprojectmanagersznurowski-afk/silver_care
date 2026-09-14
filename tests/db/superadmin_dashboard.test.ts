import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

let sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

describe('Superadmin Organizations Dashboard RPC (SC-SUP-01)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('super_admin can fetch organizations summary with aggregated counts @REQ: ORG-ISOLATION', async () => {
    await sql.begin(async (tx) => {
      // 1. Setup test organization and resident
      await tx`SET LOCAL ROLE postgres`;
      const [org] = await tx`
        INSERT INTO organizations (name, address, resident_limit)
        VALUES ('Placowka Testowa RPC', 'ul. Kwiatowa 5, Warszawa', 100)
        RETURNING id
      `;

      await tx`
        INSERT INTO residents (organization_id, first_name, last_name, pesel_hash)
        VALUES (${org.id}, 'Marian', 'Testowy', 'hashMarian')
      `;

      // 2. Call RPC as super_admin
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;

      const summary = await tx`SELECT * FROM public.get_superadmin_organization_summary() WHERE organization_id = ${org.id}`;
      expect(summary.length).toBe(1);
      expect(summary[0].organization_name).toBe('Placowka Testowa RPC');
      expect(summary[0].address).toBe('ul. Kwiatowa 5, Warszawa');
      expect(Number(summary[0].resident_limit)).toBe(100);
      expect(Number(summary[0].active_resident_count)).toBe(1);

      throw new Error('ROLLBACK');
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });

  it('rejects execution of get_superadmin_organization_summary by non-super_admin roles @REQ: ORG-ISOLATION', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;

      // Test as org_admin
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "org_admin", "organization_id": "00000000-0000-0000-0000-000000000001"}, "aal": "aal2"}', true)`;

      let err: any;
      try {
        await tx.savepoint(async (sp) => {
          await sp`SELECT * FROM public.get_superadmin_organization_summary()`;
        });
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.message).toMatch(/Odmowa dostępu: Wymagana rola super_admin/);

      // Test as nurse
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "nurse", "organization_id": "00000000-0000-0000-0000-000000000001"}, "aal": "aal2"}', true)`;
      let nurseErr: any;
      try {
        await tx.savepoint(async (sp) => {
          await sp`SELECT * FROM public.get_superadmin_organization_summary()`;
        });
      } catch (e) {
        nurseErr = e;
      }
      expect(nurseErr).toBeDefined();
      expect(nurseErr.message).toMatch(/Odmowa dostępu: Wymagana rola super_admin/);

      throw new Error('ROLLBACK');
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
