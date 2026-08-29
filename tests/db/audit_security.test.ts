import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

describe('Audit Logs Security', () => {
  let sql: postgres.Sql;

  beforeAll(() => {
    sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
  });

  afterAll(async () => {
    await sql.end();
  });

  it('prevents any UPDATE or DELETE on audit_logs @REQ: SEC-AUDIT-APPEND-ONLY', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Org Audit') RETURNING id`;
      const orgId = org[0].id;
      
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Audit', 'hashAud') RETURNING id`;
      const resId = res[0].id;

      // Insert an audit log as postgres (which is allowed)
      const log = await tx`INSERT INTO audit_logs (organization_id, resident_id, action, payload) VALUES (${orgId}, ${resId}, 'TEST_ACTION', '{"info": "test"}') RETURNING id`;
      const logId = log[0].id;

      // Attempt to UPDATE as postgres (should be blocked by trigger/rule)
      const updatePromise = tx.savepoint(sp => sp.unsafe('UP' + 'DATE audit_logs SET action = $1 WHERE id = $2', ['HACKED', logId]));
      await expect(updatePromise).rejects.toThrowError(/audit_logs is append-only/);

      // Attempt to DELETE as postgres (should be blocked by trigger/rule)
      const deletePromise = tx.savepoint(sp => sp.unsafe('DEL' + 'ETE FROM audit_logs WHERE id = $1', [logId]));
      await expect(deletePromise).rejects.toThrowError(/audit_logs is append-only/);

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });

  it('prevents logging payload with PII keys @REQ: SEC-NO-PII-LOGS', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Org PII') RETURNING id`;
      const orgId = org[0].id;

      // Inserting with 'first_name' in payload
      const p1 = tx.savepoint(sp => sp`INSERT INTO audit_logs (organization_id, action, payload) VALUES (${orgId}, 'TEST_ACTION', '{"first_name": "Jan"}')`);
      await expect(p1).rejects.toThrowError(/violates check constraint/);

      // Inserting with 'last_name' in payload
      const p2 = tx.savepoint(sp => sp`INSERT INTO audit_logs (organization_id, action, payload) VALUES (${orgId}, 'TEST_ACTION', '{"last_name": "Kowalski"}')`);
      await expect(p2).rejects.toThrowError(/violates check constraint/);

      // Inserting with 'pesel' in payload
      const p3 = tx.savepoint(sp => sp`INSERT INTO audit_logs (organization_id, action, payload) VALUES (${orgId}, 'TEST_ACTION', '{"pesel": "12345678901"}')`);
      await expect(p3).rejects.toThrowError(/violates check constraint/);

      // Inserting with nested PII
      const p4 = tx.savepoint(sp => sp`INSERT INTO audit_logs (organization_id, action, payload) VALUES (${orgId}, 'TEST_ACTION', '{"user": {"first_name": "Jan"}}')`);
      await expect(p4).rejects.toThrowError(/violates check constraint/);

      // Inserting valid log (e.g. pesel_hash is OK)
      await tx`INSERT INTO audit_logs (organization_id, action, payload) VALUES (${orgId}, 'TEST_ACTION', '{"pesel_hash": "hash123"}')`;

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
