import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.pathname !== '/postgres') {
  throw new Error('Tests require local Supabase')
}
const sql = postgres(database.toString(), { prepare: false })
const rollback = Symbol('rollback')
afterAll(() => sql.end())

it('udostępnia raport i metryki niezależnie według ostatniej zgody @REQ: CONSENT-REVOKE', async () => {
  await sql.begin(async (tx) => {
    const org = randomUUID()
    const resident = randomUUID()
    const family = randomUUID()
    await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture zgód')`
    await tx`INSERT INTO public.residents (id, organization_id, first_name, last_name) VALUES (${resident}, ${org}, 'Test', 'Zgody')`
    await tx`INSERT INTO auth.users (id) VALUES (${family})`
    await tx`INSERT INTO public.resident_relative_links (resident_id, relative_user_id, relationship_code, role)
      VALUES (${resident}, ${family}, 'SON', 'family')`
    await tx`INSERT INTO public.daily_reports (resident_id, author_id, status, content)
      VALUES (${resident}, ${family}, 'PUBLISHED',
        ${tx.json({ text: 'Czytano książkę.', metrics: { steps: 200, hrv_ms: 10 } })})`

    const grant = (purpose: string, revoked: boolean) => tx`INSERT INTO public.consent_ledger
      (organization_id, resident_id, purpose, granted_by, granted_at, revoked_at)
      VALUES (${org}, ${resident}, ${purpose}, 'resident_self', clock_timestamp(),
        CASE WHEN ${revoked} THEN clock_timestamp() ELSE NULL END)`
    const read = async () => {
      await tx`SET LOCAL ROLE authenticated`
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
        sub: family, role: 'authenticated', aal: 'aal1', app_metadata: { role: 'family', organization_id: org },
      })}, true)`
      expect(await tx`SELECT id FROM public.daily_reports WHERE resident_id = ${resident}`).toHaveLength(0)
      const rows = await tx`SELECT content FROM public.get_family_daily_reports(${resident})`
      await tx`RESET ROLE`
      return rows.map(({ content }) => content)
    }

    await grant('family_view_basic', false)
    expect(await read()).toEqual([])
    await grant('family_report_access', false)
    expect(await read()).toEqual([{ text: 'Czytano książkę.' }])
    await grant('wellness_family_view', false)
    expect(await read()).toEqual([{ text: 'Czytano książkę.', metrics: { steps: 200 } }])
    await grant('family_report_access', true)
    expect(await read()).toEqual([{ metrics: { steps: 200 } }])
    throw rollback
  }).catch((error: unknown) => { if (error !== rollback) throw error })
})
