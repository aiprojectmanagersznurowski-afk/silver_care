import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.pathname !== '/postgres') {
  throw new Error('Tests require local Supabase')
}
const sql = postgres(database.toString(), { prepare: false })
const rollback = Symbol('rollback')
afterAll(() => sql.end())

it('potwierdza przekroczenie limitu w tej samej transakcji co import @REQ: ADM-CAPACITY-LIMIT', async () => {
  await sql.begin(async (tx) => {
    const org = randomUUID()
    const user = randomUUID()
    await tx`INSERT INTO public.organizations (id, name, resident_limit) VALUES (${org}, 'Fixture import', 1)`
    await tx`INSERT INTO auth.users (id) VALUES (${user})`
    await tx`SET LOCAL ROLE authenticated`
    await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
      sub: user, aal: 'aal2', role: 'authenticated', app_metadata: { role: 'org_admin', organization_id: org },
    })}, true)`
    const payload = tx.json(['pierwszy', 'drugi'].map((name) => ({
      first_name: 'Test', last_name: name, pesel_hash: name, admission_date: '2026-01-01',
      care_level: 'walking', is_zsn: false, gender: 'F', birth_date: '1950-01-01',
    })))
    await expect(tx.savepoint((sp) => sp`SELECT public.commit_resident_import(${payload}, false)`))
      .rejects.toMatchObject({ message: 'RESIDENT_IMPORT_CAPACITY_CONFIRMATION' })
    expect(await tx`SELECT id FROM public.residents WHERE organization_id = ${org}`).toHaveLength(0)
    const [result] = await tx`SELECT public.commit_resident_import(${payload}, true) AS result`
    expect(result.result).toEqual({ importedCount: 2, residentLimit: 1, activeResidents: 2 })
    expect(await tx`SELECT action FROM public.audit_logs WHERE organization_id = ${org} AND performed_by = ${user}
      ORDER BY action`).toEqual([{ action: 'ORGANIZATION_CAPACITY_EXCEEDED' }, { action: 'RESIDENTS_BULK_IMPORT' }])
    throw rollback
  }).catch((error: unknown) => { if (error !== rollback) throw error })
})
