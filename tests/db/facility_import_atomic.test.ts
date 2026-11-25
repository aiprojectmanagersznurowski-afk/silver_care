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

it('zapisuje pokoje, łóżka i ślad w jednej operacji @REQ: ADM-FACILITY-MANAGE', async () => {
  await sql.begin(async (tx) => {
    const org = randomUUID()
    const user = randomUUID()
    await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture import')`
    await tx`INSERT INTO auth.users (id) VALUES (${user})`
    await tx`SET LOCAL ROLE authenticated`
    await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
      sub: user, aal: 'aal2', role: 'authenticated', app_metadata: { role: 'org_admin', organization_id: org },
    })}, true)`
    const payload = tx.json([
      { number: '101', floor: 'Parter', sector: null, bedLabels: ['A', 'B'] },
      { number: '102', floor: 'Parter', sector: null, bedLabels: ['A'] },
    ])
    const [row] = await tx`SELECT public.commit_facility_structure(${payload}, false) AS imported`
    expect(row.imported).toMatchObject({ rooms: 2, beds: 3 })
    expect(await tx`SELECT b.id FROM public.beds b JOIN public.rooms r ON r.id = b.room_id
      WHERE r.organization_id = ${org}`).toHaveLength(3)
    expect(await tx`SELECT id FROM public.audit_logs WHERE organization_id = ${org}
      AND action = 'FACILITY_SCHEMA_IMPORTED' AND performed_by = ${user}`).toHaveLength(1)
    throw rollback
  }).catch((error: unknown) => { if (error !== rollback) throw error })
})
