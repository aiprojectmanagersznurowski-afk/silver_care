import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

/**
 * @REQ: ORG-ISOLATION
 * @REQ: SEC-PESEL-HASH
 *
 * Izolacja nie kończy się na placówce: rodzina i opiekun prawny widzą wyłącznie powiązanych podopiecznych
 * (kontrakt: residents read `family:own`), a struktura placówki (pokoje, łóżka, przypisania) i cudze
 * powiązania rodzin są dla nich niewidoczne. Zapis do pokoi jest dla kierownika placówki, nie dla każdego
 * konta z tej samej placówki. Każdy test działa w transakcji i kończy się ROLLBACK.
 */

const FAMILY_UID = '00000000-0000-0000-0000-0000000000f1';
const OTHER_FAMILY_UID = '00000000-0000-0000-0000-0000000000f2';

const claims = (role: string, orgId: string, sub?: string) =>
  JSON.stringify({ ...(sub ? { sub } : {}), app_metadata: { role, organization_id: orgId }, aal: 'aal2' });

type Tx = postgres.TransactionSql;

async function asRole(tx: Tx, role: string, orgId: string, sub?: string) {
  await tx`SELECT set_config('request.jwt.claims', ${claims(role, orgId, sub)}, true)`;
}

/** Dwóch podopiecznych w jednej placówce; rodzina F1 jest powiązana tylko z pierwszym. */
async function seedOrg(tx: Tx) {
  await tx`SET LOCAL ROLE authenticated`;
  await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
  const [org] = await tx`INSERT INTO organizations (name) VALUES ('Placowka RLS Rola') RETURNING id`;
  const orgId = org.id as string;

  await asRole(tx, 'org_admin', orgId);
  const [r1] = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Powiazany', 'hash-rls-1') RETURNING id`;
  const [r2] = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Anna', 'Cudza', 'hash-rls-2') RETURNING id`;
  const [room] = await tx`INSERT INTO rooms (organization_id, number, floor) VALUES (${orgId}, '101', '1') RETURNING id`;
  const [bed] = await tx`INSERT INTO beds (room_id, label) VALUES (${room.id}, '1') RETURNING id`;
  await tx`INSERT INTO bed_assignments (bed_id, resident_id) VALUES (${bed.id}, ${r1.id})`;
  await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role) VALUES (${r1.id}, ${FAMILY_UID}, 'SON', 'family')`;
  await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role) VALUES (${r2.id}, ${OTHER_FAMILY_UID}, 'DAUGHTER', 'family')`;
  return { orgId, linkedId: r1.id as string, foreignId: r2.id as string };
}

async function rollback<T>(fn: (tx: Tx) => Promise<T>) {
  await sql.begin(async (tx) => {
    await fn(tx);
    throw new Error('ROLLBACK');
  }).catch((e) => {
    if (e.message !== 'ROLLBACK') throw e;
  });
}

describe('RLS: izolacja według roli w obrębie placówki (ORG-ISOLATION)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  for (const familyRole of ['family', 'legal_guardian']) {
    it(`@REQ: ORG-ISOLATION - ${familyRole} widzi tylko powiązanego podopiecznego i własne powiązanie`, async () => {
      await rollback(async (tx) => {
        const { orgId, linkedId } = await seedOrg(tx);
        await asRole(tx, familyRole, orgId, FAMILY_UID);

        const residents = await tx`SELECT id FROM residents`;
        expect(residents.map((r) => r.id)).toEqual([linkedId]);

        const links = await tx`SELECT relative_user_id FROM resident_relative_links`;
        expect(links.map((l) => l.relative_user_id)).toEqual([FAMILY_UID]);
      });
    }, 20000);

    it(`@REQ: ORG-ISOLATION - ${familyRole} nie widzi pokoi, łóżek ani przypisań łóżek`, async () => {
      await rollback(async (tx) => {
        const { orgId } = await seedOrg(tx);
        await asRole(tx, familyRole, orgId, FAMILY_UID);

        expect(await tx`SELECT id FROM rooms`).toHaveLength(0);
        expect(await tx`SELECT id FROM beds`).toHaveLength(0);
        expect(await tx`SELECT id FROM bed_assignments`).toHaveLength(0);
      });
    }, 20000);
  }

  it('@REQ: ORG-ISOLATION - rodzina nie dodaje, nie zmienia i nie usuwa pokoi', async () => {
    await rollback(async (tx) => {
      const { orgId } = await seedOrg(tx);
      await asRole(tx, 'family', orgId, FAMILY_UID);

      await expect(
        tx.savepoint((s) => s`INSERT INTO rooms (organization_id, number, floor) VALUES (${orgId}, '999', '9')`)
      ).rejects.toThrow();

      await asRole(tx, 'org_admin', orgId);
      const [room] = await tx`SELECT id FROM rooms WHERE number = '101'`;
      await asRole(tx, 'family', orgId, FAMILY_UID);
      expect(await tx`UPDATE rooms SET floor = '7' WHERE id = ${room.id} RETURNING id`).toHaveLength(0);
      expect(await tx`DELETE FROM rooms WHERE id = ${room.id} RETURNING id`).toHaveLength(0);
    });
  }, 20000);

  it('@REQ: ORG-ISOLATION - pielęgniarka czyta strukturę placówki, ale nie dodaje pokoi; kierownik dodaje', async () => {
    await rollback(async (tx) => {
      const { orgId } = await seedOrg(tx);

      await asRole(tx, 'nurse', orgId);
      expect(await tx`SELECT id FROM residents`).toHaveLength(2);
      expect(await tx`SELECT id FROM rooms`).toHaveLength(1);
      expect(await tx`SELECT id FROM beds`).toHaveLength(1);
      expect(await tx`SELECT id FROM bed_assignments`).toHaveLength(1);
      await expect(
        tx.savepoint((s) => s`INSERT INTO rooms (organization_id, number, floor) VALUES (${orgId}, '998', '9')`)
      ).rejects.toThrow();

      await asRole(tx, 'org_admin', orgId);
      expect(await tx`INSERT INTO rooms (organization_id, number, floor) VALUES (${orgId}, '102', '1') RETURNING id`).toHaveLength(1);
    });
  }, 20000);

  it('@REQ: ORG-ISOLATION - powiązania bliskich czyta kierownik, a pielęgniarka nie (kontrakt: resident_relative_links)', async () => {
    await rollback(async (tx) => {
      const { orgId } = await seedOrg(tx);

      await asRole(tx, 'org_admin', orgId);
      expect(await tx`SELECT id FROM resident_relative_links`).toHaveLength(2);

      await asRole(tx, 'nurse', orgId);
      expect(await tx`SELECT id FROM resident_relative_links`).toHaveLength(0);
    });
  }, 20000);

  it('@REQ: ORG-ISOLATION - zdarzenia pobytu i pakiety czyta tylko kierownik (kontrakt: org_admin:own)', async () => {
    await rollback(async (tx) => {
      const { orgId, linkedId } = await seedOrg(tx);
      await tx`INSERT INTO resident_events (organization_id, resident_id, event_type, event_reason) VALUES (${orgId}, ${linkedId}, 'death', 'death')`;
      await tx`INSERT INTO resident_packages (organization_id, resident_id, package_type, package_name, monthly_rate) VALUES (${orgId}, ${linkedId}, 'zsn', 'Pakiet ZSN', 1200)`;

      expect(await tx`SELECT id FROM resident_events`).toHaveLength(1);
      expect(await tx`SELECT id FROM resident_packages`).toHaveLength(1);

      for (const [role, sub] of [['nurse', undefined], ['family', FAMILY_UID], ['legal_guardian', FAMILY_UID]] as const) {
        await asRole(tx, role, orgId, sub);
        expect(await tx`SELECT id FROM resident_events`, `${role}: resident_events`).toHaveLength(0);
        expect(await tx`SELECT id FROM resident_packages`, `${role}: resident_packages`).toHaveLength(0);
      }
    });
  }, 20000);

  it('@REQ: ORG-ISOLATION - personel obcej placówki nie widzi niczego z tej placówki', async () => {
    await rollback(async (tx) => {
      const { orgId } = await seedOrg(tx);
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      const [other] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Obca') RETURNING id`;
      expect(other.id).not.toBe(orgId);

      for (const role of ['org_admin', 'nurse']) {
        await asRole(tx, role, other.id as string);
        expect(await tx`SELECT id FROM residents`).toHaveLength(0);
        expect(await tx`SELECT id FROM rooms`).toHaveLength(0);
        expect(await tx`SELECT id FROM beds`).toHaveLength(0);
        expect(await tx`SELECT id FROM resident_relative_links`).toHaveLength(0);
      }
    });
  }, 20000);
});
