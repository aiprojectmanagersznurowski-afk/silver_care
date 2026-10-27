import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { AGENDA_FAMILY_EXCLUSION } from '../../packages/contracts/src/generated/presentation';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

/**
 * @REQ: FAM-AGENDA-NO-MEDICAL
 *
 * Baza nie zwraca bliskim pozycji planu dnia z treścią medyczną: agenda_items.family_visible ustawiane
 * triggerem z tych samych słów co kontrakt, polityka RLS rodziny wymaga family_visible.
 * Każdy test działa w transakcji i kończy się ROLLBACK.
 */
type Tx = postgres.TransactionSql;
const FAMILY_UID = '00000000-0000-0000-0000-0000000000a7';

async function rollback(fn: (tx: Tx) => Promise<void>) {
  await sql.begin(async (tx) => {
    await fn(tx);
    throw new Error('ROLLBACK');
  }).catch((e) => {
    if (e.message !== 'ROLLBACK') throw e;
  });
}

async function seed(tx: Tx) {
  await tx`SET LOCAL ROLE authenticated`;
  await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
  const [org] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Plan Bez Lekow') RETURNING id`;
  await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ app_metadata: { role: 'org_admin', organization_id: org.id }, aal: 'aal2' })}, true)`;
  const [res] = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${org.id}, 'Jan', 'Testowy', 'hash-agenda-med') RETURNING id`;
  await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role) VALUES (${res.id}, ${FAMILY_UID}, 'family', 'family')`;
  return { orgId: org.id as string, residentId: res.id as string };
}

describe('Plan dnia rodziny bez treści medycznych (FAM-AGENDA-NO-MEDICAL)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('@REQ: FAM-AGENDA-NO-MEDICAL - trigger oznacza każde słowo z kontraktu i typ medication jako niewidoczne dla rodziny', async () => {
    await rollback(async (tx) => {
      const { orgId, residentId } = await seed(tx);
      const terms = Object.values(AGENDA_FAMILY_EXCLUSION.termsByCategory).flat();
      for (const term of terms) {
        const [row] = await tx`INSERT INTO agenda_items (organization_id, resident_id, title, time, type) VALUES (${orgId}, ${residentId}, ${'Plan: ' + term.toUpperCase() + 'x'}, '08:00', 'other') RETURNING family_visible`;
        expect(row.family_visible, term).toBe(false);
      }
      const [byType] = await tx`INSERT INTO agenda_items (organization_id, resident_id, title, time, type) VALUES (${orgId}, ${residentId}, 'Poranek', '08:00', 'medication') RETURNING family_visible`;
      expect(byType.family_visible).toBe(false);
      for (const title of ['Wizyta wnuczki', 'Lekcja tańca', 'Obiad']) {
        const [row] = await tx`INSERT INTO agenda_items (organization_id, resident_id, title, time, type) VALUES (${orgId}, ${residentId}, ${title}, '12:00', 'activity') RETURNING family_visible`;
        expect(row.family_visible, title).toBe(true);
      }
    });
  }, 30000);

  it('@REQ: FAM-AGENDA-NO-MEDICAL - edycja tytułu przelicza widoczność; rodzina nie czyta pozycji medycznych', async () => {
    await rollback(async (tx) => {
      const { orgId, residentId } = await seed(tx);
      const [item] = await tx`INSERT INTO agenda_items (organization_id, resident_id, title, time, type) VALUES (${orgId}, ${residentId}, 'Spacer', '10:00', 'activity') RETURNING id`;
      await tx`INSERT INTO agenda_items (organization_id, resident_id, title, time, type) VALUES (${orgId}, ${residentId}, 'Obiad', '13:00', 'meal')`;
      const [updated] = await tx`UPDATE agenda_items SET title = 'Podanie leków' WHERE id = ${item.id} RETURNING family_visible`;
      expect(updated.family_visible).toBe(false);

      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: FAMILY_UID, app_metadata: { role: 'family', organization_id: orgId }, aal: 'aal1' })}, true)`;
      const titles = (await tx`SELECT title FROM agenda_items`).map((r) => r.title);
      expect(titles).toEqual(['Obiad']);
    });
  }, 30000);
});
