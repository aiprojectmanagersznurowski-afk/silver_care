import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.port !== '54322'
  || database.username !== 'postgres' || database.pathname !== '/postgres') throw new Error('Local database required')
const sql = postgres(database.toString(), { prepare: false })
const rollback = Symbol('rollback')
afterAll(() => sql.end())

it('zredagowane fakty z notatki APP zachowują wybranego podopiecznego i źródłowy szkic @REQ: VOICE-DOCK-REPORTS', async () => {
  await sql.begin(async (tx) => {
    const org = randomUUID()
    const user = randomUUID()
    const resident = randomUUID()
    const draft = randomUUID()
    await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture raporty APP')`
    await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
      VALUES (${user}, 'authenticated', 'authenticated',
        jsonb_build_object('role', 'nurse', 'organization_id', ${org}::uuid))`
    await tx`INSERT INTO public.residents (id, organization_id, first_name, last_name)
      VALUES (${resident}, ${org}, 'Alicja', 'Fikcyjna')`
    await tx`INSERT INTO public.voice_draft_notes (id, resident_id, nurse_id, audio_url, transcript, status)
      VALUES (${draft}, ${resident}, ${user}, 'local-only', 'Brakuje kubków.', 'DRAFT')`
    await tx`UPDATE public.voice_draft_notes SET status = 'PROCESSED' WHERE id = ${draft}`
    await tx`SET LOCAL ROLE authenticated`
    await expect(tx.savepoint((sp) => sp`SELECT public.claim_processed_app_voice_draft(${draft})`))
      .rejects.toMatchObject({ code: '42501' })
    await tx`SET LOCAL ROLE service_role`
    const [claimed] = await tx`SELECT public.claim_processed_app_voice_draft(${draft}) AS result`
    expect(claimed.result).toMatchObject({ draft_id: draft, resident_id: resident, author_id: user })
    const payload = tx.json({ operational_facts: ['Brakuje kubków.'], category_codes: ['catering_kitchen'] })
    await tx`SELECT public.complete_processed_app_voice_draft(${draft}, ${claimed.result.token}, ${payload}::jsonb)`
    const [event] = await tx`SELECT * FROM public.voice_sanitized_events WHERE draft_note_id = ${draft}`
    expect(event).toMatchObject({
      sanitized_text: 'Brakuje kubków.', resident_id: resident, scope: 'resident', capture_source: 'APP',
    })
    expect(await tx`SELECT id FROM public.daily_reports WHERE resident_id = ${resident}`).toHaveLength(0)
    throw rollback
  }).catch((error: unknown) => { if (error !== rollback) throw error })
})
