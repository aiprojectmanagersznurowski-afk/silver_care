import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { test, expect } from '../fixtures/base-test';
import { AuditPage } from '../page-objects/AuditPage.spec.helper';
import { TEST_USERS } from '../fixtures/test-users';

/**
 * @REQ: SEC-AUDIT-APPEND-ONLY
 * @REQ: SEC-NO-PII-LOGS
 *
 * Testy E2E dla widoku rejestru audytowego:
 * AC1: Widoczność kolumny User ID (identyfikator aktora)
 * AC2: Filtrowanie po zakresie dat
 * AC3: Przycisk eksportu audytu
 */
test.describe('Rejestr Audytowy RODO — Filtrowanie, Eksport i Strefy Czasowe (@REQ: SEC-AUDIT-APPEND-ONLY, @REQ: SEC-NO-PII-LOGS)', () => {
  test('@REQ: SEC-AUDIT-APPEND-ONLY - Rejestr audytowy eksponuje User ID oraz kontrolki filtrów i eksportu', async ({ loginPage, page }) => {
    const auditPage = new AuditPage(page);
    await loginPage.loginAs('super_admin');
    await auditPage.goto();
    await auditPage.expectLoaded();

    // AC1: Widoczna kolumna z identyfikatorem użytkownika
    await auditPage.expectUserIdColumnVisible();

    // AC2: Kontrolki wyboru zakresu dat
    await auditPage.expectFilterControlsVisible();

    // AC3: Przycisk eksportu wyciągu
    await auditPage.expectExportControlsVisible();
  });
});

test('@REQ: NUR-SHIFT-CLOSURE - rejestr filtruje zdarzenia zmian według całej doby placówki przy zmianie czasu', async ({ loginPage, page }) => {
  const sql = postgres((process.env.DATABASE_URL || process.env.POSTGRES_URL)!, { prepare: false });
  const [first, last, before, after, unrelated] = Array.from({ length: 5 }, () => randomUUID());
  const ids = [first, last, before, after, unrelated];
  try {
    const [admin] = await sql`SELECT id, raw_app_meta_data->>'organization_id' AS org FROM auth.users WHERE email = ${TEST_USERS.org_admin.email}`;
    await sql`INSERT INTO public.audit_logs (id, organization_id, performed_by, action, created_at, payload) VALUES
      (${first}, ${admin.org}, ${admin.id}, 'SHIFT_PLAN_PRINTED', '2026-10-24T22:00:00Z', ${sql.json({ test_ref: first })}),
      (${last}, ${admin.org}, ${admin.id}, 'VOICE_CAPTURE_RECEIVED', '2026-10-25T22:59:59Z', ${sql.json({ test_ref: last })}),
      (${before}, ${admin.org}, ${admin.id}, 'SHIFT_PLAN_PRINTED', '2026-10-24T21:59:59Z', ${sql.json({ test_ref: before })}),
      (${after}, ${admin.org}, ${admin.id}, 'SHIFT_PLAN_PRINTED', '2026-10-25T23:00:00Z', ${sql.json({ test_ref: after })}),
      (${unrelated}, ${admin.org}, ${admin.id}, 'ROLE_CHANGED', '2026-10-25T13:00:00Z', ${sql.json({ test_ref: unrelated })})`;
    await loginPage.loginAs('org_admin');
    const auditPage = new AuditPage(page);
    await auditPage.goto();
    await auditPage.filterShiftEvents('2026-10-25', '2026-10-25');
    await expect(auditPage.table.getByText(first, { exact: false })).toBeVisible();
    await expect(auditPage.table.getByText(last, { exact: false })).toBeVisible();
    for (const excluded of [before, after, unrelated]) {
      await expect(auditPage.table.getByText(excluded, { exact: false })).toHaveCount(0);
    }
  } finally {
    await sql.begin(async (tx) => {
      await tx`SELECT set_config('audit.allow_redact', 'true', true)`;
      await tx`DELETE FROM public.audit_logs WHERE id IN ${tx(ids)}`;
    });
    await sql.end();
  }
});

test('@REQ: NUR-SHIFT-CLOSURE - eksport CSV i JSON obejmuje cały zakres w strefie placówki', async ({ loginPage, page }) => {
  const { readFile } = await import('node:fs/promises');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  const first = randomUUID();
  const foreign = randomUUID();
  const batch = randomUUID();
  try {
    const [admin] = await sql`SELECT id, raw_app_meta_data->>'organization_id' AS org
      FROM auth.users WHERE email = ${TEST_USERS.org_admin.email}`;
    const [other] = await sql`INSERT INTO public.organizations (name) VALUES ('Test izolacji eksportu') RETURNING id`;
    await sql`INSERT INTO public.audit_logs (organization_id, performed_by, action, created_at, payload)
      SELECT ${admin.org}, ${admin.id}, 'SHIFT_HANDOVER_APPROVED', '2026-03-29T18:00:00Z'::timestamptz,
        jsonb_build_object('test_batch', ${batch}::text, 'test_row', row)
      FROM generate_series(1, 202) row`;
    await sql`INSERT INTO public.audit_logs (organization_id, performed_by, action, created_at, payload) VALUES
      (${admin.org}, ${admin.id}, 'SHIFT_HANDOVER_ACKNOWLEDGED', '2026-03-28T23:00:00Z',
        jsonb_build_object('test_batch', ${batch}::text, 'test_ref', ${first}::text)),
      (${other.id}, ${admin.id}, 'SHIFT_HANDOVER_AMENDMENT_APPROVED', '2026-03-29T17:00:00Z',
        jsonb_build_object('test_batch', ${batch}::text, 'test_ref', ${foreign}::text))`;

    await loginPage.loginAs('org_admin');
    const auditPage = new AuditPage(page);
    await auditPage.goto();
    await auditPage.filterShiftEvents('2026-03-29', '2026-03-29');
    await expect(page).toHaveURL(/scope=shift/);
    await expect(auditPage.table.getByText(first, { exact: false })).toHaveCount(0);

    const csv = await auditPage.export('csv');
    const json = await auditPage.export('json');
    const csvText = await readFile((await csv.path())!, 'utf8');
    const exported: { payload: { test_batch?: string; test_ref?: string } }[] = JSON.parse(await readFile((await json.path())!, 'utf8'));
    expect(csvText).toContain(first);
    expect(csvText).not.toContain(foreign);
    const rows = exported.filter((event) => event.payload.test_batch === batch);
    expect(rows).toHaveLength(203);
    expect(rows.some((event) => event.payload.test_ref === first)).toBe(true);
    expect(rows.some((event) => event.payload.test_ref === foreign)).toBe(false);
  } finally {
    await sql.begin(async (tx) => {
      await tx`SELECT set_config('audit.allow_redact', 'true', true)`;
      await tx`DELETE FROM public.audit_logs WHERE payload->>'test_batch' = ${batch}`;
    });
    await sql.end();
  }
});
