import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

/**
 * @REQ: SUP-IAM-PANEL
 *
 * SC-SUP-05: system_alerts.expires_at — opcjonalny termin wygaśnięcia, późniejszy niż utworzenie.
 * Każdy test działa w transakcji i kończy się ROLLBACK.
 */

type Tx = postgres.TransactionSql;

async function asSuperAdmin(tx: Tx) {
  await tx`SET LOCAL ROLE authenticated`;
  await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
}

async function rollback(fn: (tx: Tx) => Promise<void>) {
  await sql.begin(async (tx) => {
    await fn(tx);
    throw new Error('ROLLBACK');
  }).catch((e) => {
    if (e.message !== 'ROLLBACK') throw e;
  });
}

async function attempt(tx: Tx, fn: (sp: Tx) => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint((sp) => fn(sp as unknown as Tx));
    return 'ok';
  } catch (e) {
    return (e as Error).message;
  }
}

describe('system_alerts.expires_at (SUP-IAM-PANEL)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('@REQ: SUP-IAM-PANEL - alert z terminem w przyszłości i bez terminu zapisuje się; termin przed utworzeniem jest odrzucany', async () => {
    await rollback(async (tx) => {
      await asSuperAdmin(tx);
      expect(await attempt(tx, (sp) => sp`INSERT INTO system_alerts (title, message) VALUES ('Bez terminu', 'Treść alertu')`)).toBe('ok');
      expect(await attempt(tx, (sp) => sp`INSERT INTO system_alerts (title, message, expires_at) VALUES ('Z terminem', 'Treść alertu', now() + interval '2 hours')`)).toBe('ok');
      expect(await attempt(tx, (sp) => sp`INSERT INTO system_alerts (title, message, expires_at) VALUES ('Termin wstecz', 'Treść alertu', now() - interval '1 hour')`)).toMatch(/system_alerts_expires_after_created/);
    });
  }, 20000);
});
