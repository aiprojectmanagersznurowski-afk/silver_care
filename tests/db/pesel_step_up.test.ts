import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

describe('PESEL Step-Up Audit and Column Invariant (SEC-PESEL-STEP-UP)', () => {
  let sql: postgres.Sql;

  beforeAll(() => {
    sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
  });

  afterAll(async () => {
    await sql.end();
  });

  it('keeps database invariant: pesel_encrypted exists, but raw pesel never exists @REQ: SEC-PESEL-HASH', async () => {
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'residents' AND table_schema = 'public'
    `;
    const colNames = columns.map(c => c.column_name);

    expect(colNames).toContain('pesel_hash');
    expect(colNames).toContain('pesel_encrypted');
    expect(colNames).not.toContain('pesel');
  });

  it('logs pesel access attempts immutably and NEVER writes raw PESEL into logs @REQ: SEC-NO-PII-LOGS @REQ: SEC-403-LOGGING', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;

      const org = await tx`INSERT INTO organizations (name) VALUES ('Pesel Audit Org') RETURNING id`;
      const orgId = org[0].id;
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Nowak', 'fakehash') RETURNING id`;
      const residentId = res[0].id;

      const nurseId = '43434343-4343-4343-4343-434343434343';

      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
        sub: nurseId,
        app_metadata: { role: 'nurse', organization_id: orgId },
        aal: 'aal2'
      })}, true)`;

      // 1. Log failure attempt
      await tx`SELECT public.log_pesel_access_attempt(${residentId}, 'AUTH_FAILURE', 'NFZ_RECEPTA')`;

      // 2. Log success attempt
      await tx`SELECT public.log_pesel_access_attempt(${residentId}, 'AUTH_SUCCESS', 'PRZYJECIE_SZPITAL')`;

      // 3. Inspect audit_logs as admin/postgres
      await tx`SET LOCAL ROLE postgres`;
      const auditRows = await tx`SELECT * FROM public.audit_logs WHERE performed_by = ${nurseId} ORDER BY created_at ASC`;
      expect(auditRows.length).toBe(2);

      for (const row of auditRows) {
        expect(row.payload.target_resident_id).toBe(residentId);
        // Ensure no 11-digit numbers or raw pesel field exists in log payload
        const serialized = JSON.stringify(row.payload);
        expect(serialized).not.toMatch(/\b\d{11}\b/);
        expect(serialized).not.toMatch(/"pesel"/i);
      }

      throw new Error('ROLLBACK');
    }).catch(e => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
