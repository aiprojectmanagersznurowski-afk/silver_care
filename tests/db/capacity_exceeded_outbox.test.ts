import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

/**
 * @REQ: ADM-CAPACITY-LIMIT
 *
 * Wpis ORGANIZATION_CAPACITY_EXCEEDED w audit_logs zakłada w kolejce outbox_notifications
 * dwa powiadomienia: A4 (kierownik placówki) i A5 (super admin) — z samymi liczbami, bez danych osobowych.
 * Każdy test działa w transakcji i kończy się ROLLBACK.
 */
type Tx = postgres.TransactionSql;

async function rollback(fn: (tx: Tx) => Promise<void>) {
  await sql.begin(async (tx) => {
    await fn(tx);
    throw new Error('ROLLBACK');
  }).catch((e) => {
    if (e.message !== 'ROLLBACK') throw e;
  });
}

describe('Kolejka powiadomień o przekroczeniu limitu miejsc (ADM-CAPACITY-LIMIT)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('@REQ: ADM-CAPACITY-LIMIT - przekroczenie w audycie zakłada A4 i A5 w outbox bez danych osobowych', async () => {
    await rollback(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      const [org] = await tx`INSERT INTO organizations (name, resident_limit) VALUES ('Placowka Powiadomienia Limit', 50) RETURNING id`;
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ app_metadata: { role: 'org_admin', organization_id: org.id }, aal: 'aal2' })}, true)`;
      const payload = { operation: 'bed_create', counts: 'beds', resident_limit: 50, projected_count: 53, excess: 3 };
      await tx`INSERT INTO audit_logs (organization_id, action, payload) VALUES (${org.id}, 'ORGANIZATION_CAPACITY_EXCEEDED', ${tx.json(payload)})`;

      await tx`RESET ROLE`;
      const rows = await tx`SELECT entity_type, entity_id, payload, status FROM outbox_notifications WHERE organization_id = ${org.id} ORDER BY payload->>'notification_id'`;
      expect(rows.map((r) => r.payload.notification_id)).toEqual(['A4', 'A5']);
      for (const r of rows) {
        expect(r.entity_type).toBe('capacity_exceeded');
        expect(r.entity_id).toBe(org.id);
        expect(r.status).toBe('PENDING');
        expect(r.payload).toMatchObject({ operation: 'bed_create', resident_limit: 50, projected_count: 53, excess: 3 });
        expect(JSON.stringify(r.payload)).not.toMatch(/first_name|last_name|pesel|resident_id/i);
      }
    });
  }, 30000);

  it('@REQ: ADM-CAPACITY-LIMIT - inne wpisy audytu nie zakładają powiadomień o limicie', async () => {
    await rollback(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      const [org] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Inny Audyt') RETURNING id`;
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ app_metadata: { role: 'org_admin', organization_id: org.id }, aal: 'aal2' })}, true)`;
      await tx`INSERT INTO audit_logs (organization_id, action, payload) VALUES (${org.id}, 'FACILITY_ROOM_CREATED', '{}'::jsonb)`;
      await tx`RESET ROLE`;
      const rows = await tx`SELECT 1 FROM outbox_notifications WHERE organization_id = ${org.id} AND entity_type = 'capacity_exceeded'`;
      expect(rows.length).toBe(0);
    });
  }, 30000);
});
