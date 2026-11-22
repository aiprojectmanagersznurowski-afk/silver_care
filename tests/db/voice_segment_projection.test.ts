import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.port !== '54322'
  || database.username !== 'postgres' || database.pathname !== '/postgres') throw new Error('Local database required')
const sql = postgres(database.toString(), { prepare: false })
const rollback = Symbol('rollback')
afterAll(() => sql.end())

it('zapisuje wyłącznie powiązane propozycje, z chronionym strumieniem medycznym @REQ: VOICE-DOCK-REPORTS', async () => {
  await sql.begin(async (tx) => {
    const org = randomUUID()
    const author = randomUUID()
    const resident = randomUUID()
    const capture = randomUUID()
    const segment = randomUUID()
    await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture raporty')`
    await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
      VALUES (${author}, 'authenticated', 'authenticated',
        jsonb_build_object('role', 'nurse', 'organization_id', ${org}::uuid))`
    await tx`INSERT INTO public.residents (id, organization_id, first_name, last_name)
      VALUES (${resident}, ${org}, 'Alicja', 'Fikcyjna')`
    await tx`INSERT INTO public.voice_captures
      (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at, status)
      VALUES (${capture}, ${org}, 'APP_GENERAL', ${capture}, ${org + '/fixture/' + capture}, ${'a'.repeat(64)}, ${author}, now(), 'SEGMENTED')`
    await tx`INSERT INTO public.voice_segments
      (id, organization_id, capture_id, ordinal, start_ms, end_ms, transcript_path, assignment_status, author_id, author_attribution, resident_id)
      VALUES (${segment}, ${org}, ${capture}, 0, 0, 1000, ${org + '/fixture/text'}, 'RESIDENT', ${author}, 'AUTHENTICATED_SESSION', ${resident})`
    await tx`SET LOCAL ROLE service_role`
    const [claimed] = await tx`SELECT public.claim_voice_segment_projection(${segment}) AS result`
    expect(claimed.result).toMatchObject({ segment_id: segment, resident_id: resident, author_id: author })
    const payload = tx.json({ behavioral_facts: ['Zjadła śniadanie.'],
      operational_facts: ['Brakuje kubków.'], category_codes: ['catering_kitchen'],
      restricted_medical: ['Przykładowy materiał chroniony.'] })
    await tx`SELECT public.complete_voice_segment_projection(${segment}, ${claimed.result.token}, ${payload}::jsonb)`
    const [event] = await tx`SELECT * FROM public.voice_sanitized_events WHERE segment_id = ${segment}`
    expect(event).toMatchObject({ sanitized_text: 'Brakuje kubków.', scope: 'resident' })
    const [proposal] = await tx`SELECT * FROM public.voice_segment_proposals WHERE segment_id = ${segment}`
    expect(proposal).toMatchObject({ behavioral_facts: ['Zjadła śniadanie.'], reviewed_at: null })
    const [restricted] = await tx`SELECT data FROM public.daily_logs WHERE resident_id = ${resident}`
    expect(restricted.data.medical).toEqual(['Przykładowy materiał chroniony.'])
    const [again] = await tx`SELECT public.claim_voice_segment_projection(${segment}) AS result`
    expect(again.result).toBeNull()
    expect(await tx`SELECT id FROM public.daily_reports WHERE resident_id = ${resident}`).toHaveLength(0)
    throw rollback
  }).catch((error: unknown) => { if (error !== rollback) throw error })
})
