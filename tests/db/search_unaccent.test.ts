import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: ORG-ISOLATION
 *
 * Wyszukiwanie bez polskich znaków („zolw” znajduje „Żółw”): kolumny pomocnicze search_* są generowane z nazw
 * (małe litery, bez diakrytyków), więc nie ma osobnej kopii do synchronizacji i podlegają tym samym politykom RLS
 * co reszta wiersza. Każdy test działa w transakcji i kończy się ROLLBACK.
 */

type Tx = postgres.TransactionSql;

const claims = (role: string, orgId?: string) =>
  JSON.stringify({ app_metadata: { role, ...(orgId ? { organization_id: orgId } : {}) }, aal: 'aal2' });

async function rollback(fn: (tx: Tx) => Promise<void>) {
  await sql.begin(async (tx) => {
    await fn(tx);
    throw new Error('ROLLBACK');
  }).catch((e) => {
    if (e.message !== 'ROLLBACK') throw e;
  });
}

async function seedOrg(tx: Tx, name: string) {
  await tx`SET LOCAL ROLE authenticated`;
  await tx`SELECT set_config('request.jwt.claims', ${claims('super_admin')}, true)`;
  const [org] = await tx`INSERT INTO organizations (name) VALUES (${name}) RETURNING id, search_name`;
  await tx`SELECT set_config('request.jwt.claims', ${claims('org_admin', org.id)}, true)`;
  return { orgId: org.id as string, orgSearchName: org.search_name as string };
}

describe('Wyszukiwanie bez polskich znaków (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - rozszerzenie unaccent w schemacie extensions i niezmienna funkcja f_unaccent', async () => {
    const [ext] = await sql`SELECT extnamespace::regnamespace::text AS schema FROM pg_extension WHERE extname = 'unaccent'`;
    expect(ext?.schema).toBe('extensions');
    const [fn] = await sql`SELECT provolatile FROM pg_proc WHERE proname = 'f_unaccent' AND pronamespace = 'public'::regnamespace`;
    expect(fn?.provolatile).toBe('i');
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - residents.search_name: małe litery, bez diakrytyków, także ł', async () => {
    await rollback(async (tx) => {
      const { orgId } = await seedOrg(tx, 'Placowka Search Residents');
      const [r] = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Żółw', 'Łukasiewicz-Ćwik', 'hash-search-1') RETURNING search_name`;
      expect(r.search_name).toBe('zolw lukasiewicz-cwik');

      const hit = await tx`SELECT id FROM residents WHERE search_name ILIKE '%zolw%' AND search_name ILIKE '%lukasiew%'`;
      expect(hit).toHaveLength(1);
    });
  }, 20000);

  it('@REQ: UI-TEMPLATE-ALIGNMENT - zmiana nazwiska przelicza kolumnę sama, bez osobnej synchronizacji', async () => {
    await rollback(async (tx) => {
      const { orgId } = await seedOrg(tx, 'Placowka Search Update');
      const [r] = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Kowalski', 'hash-search-2') RETURNING id`;
      const [after] = await tx`UPDATE residents SET last_name = 'Wiśniewski' WHERE id = ${r.id} RETURNING search_name`;
      expect(after.search_name).toBe('jan wisniewski');
    });
  }, 20000);

  it('@REQ: UI-TEMPLATE-ALIGNMENT - organizations.search_name i agenda_items.search_title', async () => {
    await rollback(async (tx) => {
      const { orgId, orgSearchName } = await seedOrg(tx, 'Dom Książęcy na Wzgórzu');
      expect(orgSearchName).toBe('dom ksiazecy na wzgorzu');
      const [item] = await tx`INSERT INTO agenda_items (organization_id, resident_id, title, time, type) VALUES (${orgId}, null, 'Śniadanie i gimnastyka', '08:00', 'MEAL') RETURNING search_title`;
      expect(item.search_title).toBe('sniadanie i gimnastyka');
    });
  }, 20000);

  it('@REQ: ORG-ISOLATION - kolumna pomocnicza podlega RLS: personel obcej placówki jej nie widzi', async () => {
    await rollback(async (tx) => {
      const { orgId } = await seedOrg(tx, 'Placowka Search A');
      await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Zofia', 'Zażółć', 'hash-search-3')`;

      await tx`SELECT set_config('request.jwt.claims', ${claims('super_admin')}, true)`;
      const [other] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Search B') RETURNING id`;
      await tx`SELECT set_config('request.jwt.claims', ${claims('org_admin', other.id)}, true)`;

      expect(await tx`SELECT search_name FROM residents WHERE search_name ILIKE '%zazolc%'`).toHaveLength(0);
    });
  }, 20000);
});
