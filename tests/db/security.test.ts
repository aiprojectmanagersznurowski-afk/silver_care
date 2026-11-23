import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
const rollback = new Error('rollback security fixtures');

async function asRole(tx: postgres.TransactionSql, role: string, organizationId: string, userId: string, aal: string) {
  await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
    sub: userId,
    role: 'authenticated',
    app_metadata: { role, organization_id: organizationId },
    aal,
  })}, true)`;
}

async function withFixtures(check: (tx: postgres.TransactionSql, ids: {
  orgId: string;
  residentId: string;
  auditId: string;
  foreignAuditId: string;
  userId: string;
}) => Promise<void>) {
  await sql.begin(async (tx) => {
    const [org] = await tx`INSERT INTO public.organizations (name) VALUES ('MFA fixtures') RETURNING id`;
    const [foreignOrg] = await tx`INSERT INTO public.organizations (name) VALUES ('MFA other facility') RETURNING id`;
    const [resident] = await tx`
      INSERT INTO public.residents (organization_id, first_name, last_name)
      VALUES (${org.id}, 'Jan', 'Testowy') RETURNING id
    `;
    const [audit] = await tx`
      INSERT INTO public.audit_logs (organization_id, resident_id, action)
      VALUES (${org.id}, ${resident.id}, 'mfa_fixture') RETURNING id
    `;
    const [foreignAudit] = await tx`
      INSERT INTO public.audit_logs (organization_id, action)
      VALUES (${foreignOrg.id}, 'mfa_fixture') RETURNING id
    `;
    const userId = randomUUID();
    await tx`
      INSERT INTO public.resident_relative_links (resident_id, relative_user_id, relationship_code, role)
      VALUES (${resident.id}, ${userId}, 'SON', 'family')
    `;

    await tx`SET LOCAL ROLE authenticated`;
    await check(tx, {
      orgId: org.id,
      residentId: resident.id,
      auditId: audit.id,
      foreignAuditId: foreignAudit.id,
      userId,
    });
    throw rollback;
  }).catch((error: unknown) => {
    if (error !== rollback) throw error;
  });
}

describe('Database Security MFA', () => {
  afterAll(() => sql.end());

  it('@REQ: SEC-MFA-STAFF - personel odczytuje podopiecznego po potwierdzeniu drugiego składnika', async () => {
    await withFixtures(async (tx, { orgId, residentId, userId }) => {
      for (const role of ['org_admin', 'nurse']) {
        await asRole(tx, role, orgId, userId, 'aal1');
        await expect(tx.savepoint((sp) => sp`SELECT id FROM public.residents WHERE id = ${residentId}`))
          .rejects.toMatchObject({ code: '42501' });

        await asRole(tx, role, orgId, userId, 'aal2');
        expect(await tx`SELECT id FROM public.residents WHERE id = ${residentId}`).toEqual([{ id: residentId }]);
      }
    });
  });

  it('@REQ: SEC-MFA-STAFF - odczyt audytu wymaga drugiego składnika i zachowuje zakres roli', async () => {
    await withFixtures(async (tx, { orgId, auditId, foreignAuditId, userId }) => {
      for (const role of ['org_admin', 'super_admin']) {
        await asRole(tx, role, orgId, userId, 'aal1');
        await expect(tx.savepoint((sp) => sp`SELECT id FROM public.audit_logs WHERE id = ${auditId}`))
          .rejects.toMatchObject({ code: '42501' });
      }

      await asRole(tx, 'org_admin', orgId, userId, 'aal2');
      expect(await tx`SELECT id FROM public.audit_logs WHERE id IN (${auditId}, ${foreignAuditId})`)
        .toEqual([{ id: auditId }]);
      await asRole(tx, 'super_admin', orgId, userId, 'aal2');
      expect(await tx`SELECT id FROM public.audit_logs WHERE id IN (${auditId}, ${foreignAuditId})`)
        .toEqual(expect.arrayContaining([{ id: auditId }, { id: foreignAuditId }]));
    });
  });

  it('@REQ: SEC-MFA-STAFF - bliski ma odczyt powiązanego podopiecznego w widoku rodzin bez drugiego składnika', async () => {
    await withFixtures(async (tx, { orgId, residentId, userId }) => {
      await asRole(tx, 'family', orgId, userId, 'aal1');
      expect(await tx`SELECT id FROM public.get_family_resident_overview()`).toEqual([{ id: residentId }]);
    });
  });

  it('@REQ: SEC-MFA-STAFF - wyłącznie operator może czasowo dopuścić aal1 bez zmiany roli i zakresu placówki', async () => {
    await withFixtures(async (tx, { orgId, auditId, foreignAuditId, residentId, userId }) => {
      await asRole(tx, 'org_admin', orgId, userId, 'aal1');
      expect((await tx`SELECT public.staff_mfa_satisfied() AS allowed`)[0].allowed).toBe(false);
      await expect(tx.savepoint((sp) => sp`SELECT id FROM public.audit_logs WHERE id = ${auditId}`))
        .rejects.toMatchObject({ code: '42501' });
      await expect(tx.savepoint((sp) => sp`
        CREATE OR REPLACE FUNCTION private.staff_mfa_disabled_for_tests() RETURNS boolean LANGUAGE sql RETURN true
      `)).rejects.toMatchObject({ code: '42501' });

      await tx`RESET ROLE`;
      await tx`CREATE OR REPLACE FUNCTION private.staff_mfa_disabled_for_tests() RETURNS boolean LANGUAGE sql STABLE RETURN true`;
      await tx`SET LOCAL ROLE authenticated`;
      expect((await tx`SELECT public.staff_mfa_satisfied() AS allowed`)[0].allowed).toBe(true);
      expect(await tx`SELECT id FROM public.audit_logs WHERE id IN (${auditId}, ${foreignAuditId})`)
        .toEqual([{ id: auditId }]);
      expect(await tx`SELECT id FROM public.residents WHERE id = ${residentId}`).toEqual([{ id: residentId }]);
      expect((await tx`SELECT auth.jwt()->>'aal' AS level`)[0].level).toBe('aal1');

      await asRole(tx, 'nurse', orgId, userId, 'aal1');
      expect(await tx`SELECT id FROM public.audit_logs WHERE id = ${auditId}`).toEqual([]);
      await asRole(tx, 'family', orgId, userId, 'aal1');
      expect((await tx`SELECT public.staff_mfa_satisfied() AS allowed`)[0].allowed).toBe(false);
    });
  });
});
