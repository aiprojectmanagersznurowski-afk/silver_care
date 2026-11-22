import { randomUUID } from 'node:crypto'
import { OPERATIONAL_REPORT_ENGINE } from '@silvercare/contracts/src/generated/voice'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.port !== '54322'
  || database.username !== 'postgres' || database.pathname !== '/postgres') {
  throw new Error('Operational report tests require the local Supabase test database')
}
const sql = postgres(database.toString(), { prepare: false })
type Tx = postgres.TransactionSql
const rollback = Symbol('rollback')
const emptyModel = 'rule-based-no-data-v1'
const periods = { start: '2026-01-01T00:00:00Z', end: '2026-01-02T00:00:00Z' }

afterAll(() => sql.end())

async function transaction(test: (tx: Tx) => Promise<void>) {
  await sql.begin(async (tx) => {
    await test(tx)
    throw rollback
  }).catch((error: unknown) => {
    if (error !== rollback) throw error
  })
}

async function setup(tx: Tx) {
  const org = randomUUID()
  const other = randomUUID()
  const user = randomUUID()
  await tx`INSERT INTO public.organizations (id, name)
    VALUES (${org}, 'Fixture raporty A'), (${other}, 'Fixture raporty B')`
  await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
    VALUES (${user}, 'authenticated', 'authenticated',
      jsonb_build_object('role', 'org_admin', 'organization_id', ${org}::uuid))`
  return { org, other, user }
}

async function staff(tx: Tx, user: string, org: string, role = 'org_admin', aal = 'aal2') {
  await tx`SET LOCAL ROLE authenticated`
  await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
    sub: user, role: 'authenticated', aal, session_id: randomUUID(),
    app_metadata: { role, organization_id: org },
  })}, true)`
}

async function service(tx: Tx) {
  await tx`SET LOCAL ROLE service_role`
  await tx`SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true)`
}

function emptyReport(tx: Tx, org: string) {
  const content = JSON.stringify({ no_data: true, summary: 'Brak zarejestrowanych zdarzeń w wybranym okresie.',
    events: [], action_items: [] })
  return tx`SELECT * FROM public.record_generated_operational_report(
    ${org}, 'audit_operational', ${periods.start}, ${periods.end}, '[]', ${content},
    ${emptyModel}, ${emptyModel}, ${periods.end})`
}

describe('Raporty operacyjne', () => {
  it('provisionuje kategorie z kontraktu i izoluje odczyt według roli, placówki i MFA @REQ: VOICE-DOCK-REPORTS', async () => {
    await transaction(async (tx) => {
      const { org, other, user } = await setup(tx)
      await staff(tx, user, org)
      const configs = await tx`SELECT * FROM public.get_organization_report_configs(${org})`
      expect(configs).toHaveLength(OPERATIONAL_REPORT_ENGINE.defaultCategories.length)
      for (const category of OPERATIONAL_REPORT_ENGINE.defaultCategories) {
        expect(configs).toContainEqual(expect.objectContaining({
          category_code: category.code, category_label: category.label,
          schedule_mode: category.defaultSchedule, allowed_sections: [...category.defaultSections],
          recipient_roles: [...category.defaultRecipientRoles], requires_approval: category.requiresApproval,
          retention_days: category.defaultRetentionDays, is_enabled: true,
        }))
      }
      await expect(tx.savepoint((sp) => sp`SELECT * FROM public.get_organization_report_configs(${other})`))
        .rejects.toMatchObject({ code: '42501' })
      for (const role of ['family', 'legal_guardian']) {
        await staff(tx, user, org, role)
        expect(await tx`SELECT id FROM public.organization_report_configs`).toHaveLength(0)
        expect(await tx`SELECT id FROM public.operational_reports`).toHaveLength(0)
      }
      await staff(tx, user, org, 'org_admin', 'aal1')
      expect(await tx`SELECT id FROM public.organization_report_configs`).toHaveLength(0)
      await expect(tx.savepoint((sp) => sp`SELECT * FROM public.get_organization_report_configs(${org})`))
        .rejects.toMatchObject({ code: '42501', message: 'MFA_AAL2_REQUIRED' })
    })
  })

  it('harmonogram wybiera zamknięty okres, a odbiorcy kategorii ograniczają odczyt i akceptację @REQ: VOICE-DOCK-REPORTS', async () => {
    await transaction(async (tx) => {
      const { org, user } = await setup(tx)
      await service(tx)
      const [due] = await tx`SELECT public.claim_due_operational_report(
        ${org}, now() + interval '2 days') AS result`
      expect(due.result).toMatchObject({ organization_id: org, schedule_mode: 'daily' })
      const [report] = await emptyReport(tx, org)
      await staff(tx, user, org, 'nurse')
      expect(await tx`SELECT id FROM public.operational_reports WHERE id = ${report.id}`).toHaveLength(0)
      await expect(tx.savepoint((sp) => sp`SELECT public.approve_operational_report(${report.id})`))
        .rejects.toMatchObject({ code: '42501' })
      await staff(tx, user, org)
      expect(await tx`SELECT id FROM public.operational_reports WHERE id = ${report.id}`).toHaveLength(1)
    })
  })

  it('oddziela rolę serwisową, waliduje brak danych i blokuje ponowne zatwierdzenie @REQ: VOICE-DOCK-REPORTS', async () => {
    await transaction(async (tx) => {
      const { org, user } = await setup(tx)
      await tx`SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true)`
      await expect(tx.savepoint((sp) => emptyReport(sp, org)))
        .rejects.toMatchObject({ code: '42501', message: 'SERVICE_ROLE_REQUIRED' })
      await service(tx)
      await expect(tx.savepoint((sp) => emptyReport(sp, 'CANARY_INVALID_ORGANIZATION')))
        .rejects.toMatchObject({ code: '22023', message: 'INVALID_UUID_PARAMETER' })
      const [report] = await emptyReport(tx, org)
      expect(report).toMatchObject({ status: 'DRAFT', requires_regeneration: false, ai_model: emptyModel })
      const [retry] = await emptyReport(tx, org)
      expect(retry.id).toBe(report.id)
      await expect(tx.savepoint((sp) => sp`DELETE FROM public.operational_reports WHERE id = ${report.id}`))
        .rejects.toMatchObject({ code: '42501' })
      await staff(tx, user, org)
      const [approved] = await tx`SELECT * FROM public.approve_operational_report(${report.id})`
      expect(approved).toMatchObject({ id: report.id, status: 'APPROVED', approved_by: user })
      await expect(tx.savepoint((sp) => sp`SELECT * FROM public.approve_operational_report(${report.id})`))
        .rejects.toMatchObject({ message: 'REPORT_ALREADY_APPROVED' })
    })
  })
})
