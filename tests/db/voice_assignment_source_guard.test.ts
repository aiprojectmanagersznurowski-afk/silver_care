import { randomUUID } from 'node:crypto'
import { RESIDENT_ASSIGNMENT } from '@silvercare/contracts/src/generated/voice'
import postgres from 'postgres'
import { afterAll, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (!['127.0.0.1', 'localhost'].includes(database.hostname)
  || database.username !== 'postgres' || database.pathname !== '/postgres') {
  throw new Error('Voice assignment source guard tests require local Supabase')
}
const sql = postgres(database.toString(), { prepare: false })
const rollback = Symbol('rollback')
type Tx = postgres.TransactionSql
afterAll(() => sql.end())

it.each([
  ['TIME_UNCERTAIN', 'UNKNOWN'],
  ['MIXED_SEGMENT', 'SYNCED'],
] as const)('zachowuje nierozstrzygnięty powód %s poza projekcją @REQ: VOICE-RESIDENT-ASSIGN',
  async (reason, clock) => {
    await sql.begin(async (tx) => {
      const org = randomUUID()
      const administrator = randomUUID()
      const capture = randomUUID()
      const segment = randomUUID()
      await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture wyjątku źródła')`
      await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
        VALUES (${administrator}, 'authenticated', 'authenticated',
          jsonb_build_object('role', 'org_admin', 'organization_id', ${org}::uuid))`
      await tx`INSERT INTO public.voice_captures
        (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at, clock_state, status)
        VALUES (${capture}, ${org}, 'APP_GENERAL', ${capture}, ${org + '/fixture/' + capture},
          ${'a'.repeat(64)}, ${administrator}, now(), ${clock}, 'SEGMENTED')`
      await tx`INSERT INTO public.voice_segments
        (id, organization_id, capture_id, ordinal, start_ms, end_ms, transcript_path, author_id, author_attribution)
        VALUES (${segment}, ${org}, ${capture}, 0, 0, 1000, ${org + '/fixture/' + segment},
          ${administrator}, 'AUTHENTICATED_SESSION')`
      await tx`INSERT INTO public.voice_assignment_queue (organization_id, segment_id, reasons)
        VALUES (${org}, ${segment}, ARRAY[${reason}]::text[])`
      await tx`SET LOCAL ROLE authenticated`
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
        sub: administrator, role: 'authenticated', aal: 'aal2', session_id: randomUUID(),
        app_metadata: { role: 'org_admin', organization_id: org },
      })}, true)`
      const resolve = (db: Tx, scope: (typeof RESIDENT_ASSIGNMENT.outcomes)[number]) =>
        db`SELECT public.resolve_voice_segment(${segment}, ${scope}) AS id`
      await expect(tx.savepoint((sp) => resolve(sp, 'FACILITY')))
        .rejects.toMatchObject({ code: '23514', message: 'VOICE_SEGMENT_SOURCE_REVIEW_REQUIRED' })
      expect(await tx`SELECT reasons FROM public.voice_assignment_queue WHERE segment_id = ${segment}`)
        .toEqual([{ reasons: [reason] }])
      await tx`SET LOCAL ROLE service_role`
      expect(await tx`SELECT public.claim_voice_segment_projection(${segment}) AS result`)
        .toEqual([{ result: null }])
      await tx`SET LOCAL ROLE authenticated`
      expect(await resolve(tx, 'UNASSIGNABLE')).toEqual([{ id: segment }])
      expect(await tx`SELECT segment_id FROM public.voice_assignment_queue WHERE segment_id = ${segment}`)
        .toHaveLength(0)
      throw rollback
    }).catch((error: unknown) => { if (error !== rollback) throw error })
  })

it('po konflikcie z karty kierownik może potwierdzić tylko podopiecznego wybranego przed nagraniem @REQ: VOICE-ZERO-GUESSING @REQ: VOICE-RESIDENT-ASSIGN', async () => {
  await sql.begin(async (tx) => {
    const org = randomUUID()
    const manager = randomUUID()
    const capture = randomUUID()
    const segment = randomUUID()
    const selected = randomUUID()
    const mentioned = randomUUID()
    await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture karty')`
    await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
      VALUES (${manager}, 'authenticated', 'authenticated',
        jsonb_build_object('role', 'org_admin', 'organization_id', ${org}::uuid))`
    await tx`INSERT INTO public.residents (id, organization_id, first_name, last_name)
      VALUES (${selected}, ${org}, 'Jan', 'Wybrany'), (${mentioned}, ${org}, 'Adam', 'Wspomniany')`
    await tx`INSERT INTO public.voice_captures
      (id, organization_id, source, source_key, storage_path, sha256, author_id, selected_resident_id, recorded_at, status)
      VALUES (${capture}, ${org}, 'APP', ${capture}, ${org + '/app/' + manager + '/' + capture},
        ${'a'.repeat(64)}, ${manager}, ${selected}, now(), 'SEGMENTED')`
    await tx`INSERT INTO public.voice_segments
      (id, organization_id, capture_id, ordinal, start_ms, end_ms, transcript_path, author_id, author_attribution)
      VALUES (${segment}, ${org}, ${capture}, 0, 0, 1000, ${org + '/fixture/' + segment},
        ${manager}, 'AUTHENTICATED_SESSION')`
    await tx`INSERT INTO public.voice_assignment_queue (organization_id, segment_id, reasons, candidates)
      VALUES (${org}, ${segment}, ARRAY['CONFLICTING_EVIDENCE'], ARRAY[${selected}::uuid, ${mentioned}::uuid])`
    await tx`SET LOCAL ROLE service_role`
    expect(await tx`SELECT public.claim_voice_segment_projection(${segment}) AS result`)
      .toEqual([{ result: null }])

    await tx`SET LOCAL ROLE authenticated`
    await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
      sub: manager, role: 'authenticated', aal: 'aal2', session_id: randomUUID(),
      app_metadata: { role: 'org_admin', organization_id: org },
    })}, true)`
    const resolve = (db: Tx, scope: string, resident: string | null) =>
      db`SELECT public.resolve_voice_segment(${segment}, ${scope}, ${resident}) AS id`
    await expect(tx.savepoint((sp) => resolve(sp, 'RESIDENT', mentioned)))
      .rejects.toMatchObject({ code: '23514' })
    await expect(tx.savepoint((sp) => resolve(sp, 'FACILITY', null)))
      .rejects.toMatchObject({ code: '23514' })
    expect(await resolve(tx, 'RESIDENT', selected)).toEqual([{ id: segment }])
    expect(await tx`SELECT segment_id FROM public.voice_assignment_queue WHERE segment_id = ${segment}`)
      .toHaveLength(0)

    await tx`SET LOCAL ROLE service_role`
    const [projection] = await tx`SELECT public.claim_voice_segment_projection(${segment}) AS result`
    expect(projection.result).toMatchObject({ source: 'APP', resident_id: selected, author_id: manager })
    throw rollback
  }).catch((error: unknown) => { if (error !== rollback) throw error })
})
