import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.port !== '54322'
  || database.username !== 'postgres' || database.pathname !== '/postgres') throw new Error('Local database required')
const sql = postgres(database.toString(), { prepare: false })
const rollback = Symbol('rollback')
afterAll(() => sql.end())

it('atomowo zapisuje fragmenty pod aktualną dzierżawą i odkłada wyjątki @REQ: VOICE-RESIDENT-ASSIGN @REQ: SEC-AUDIT-APPEND-ONLY', async () => {
  await sql.begin(async (tx) => {
    const org = randomUUID()
    const user = randomUUID()
    const capture = randomUUID()
    const key = randomUUID()
    await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture przetwarzania')`
    await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
      VALUES (${user}, 'authenticated', 'authenticated',
        jsonb_build_object('role', 'nurse', 'organization_id', ${org}::uuid))`
    await tx`INSERT INTO public.voice_captures
      (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at)
      VALUES (${capture}, ${org}, 'APP_GENERAL', ${key}, ${org + '/app_general/' + key}, ${'a'.repeat(64)}, ${user}, now())`
    const [intake] = await tx`SELECT payload FROM public.audit_logs
      WHERE organization_id = ${org} AND action = 'VOICE_CAPTURE_RECEIVED'`
    expect(intake.payload).toMatchObject({ capture_id: capture, source: 'APP_GENERAL', author_id: user,
      clock_state: 'SYNCED', recorded_at: expect.any(String), received_at: expect.any(String) })
    expect(intake.payload).not.toHaveProperty('storage_path')
    await expect(tx.savepoint((sp) => sp`SELECT * FROM public.claim_voice_capture(${capture})`))
      .rejects.toMatchObject({ code: '42501' })
    await tx`SET LOCAL ROLE service_role`
    const [claimed] = await tx`SELECT * FROM public.claim_voice_capture(${capture})`
    expect(claimed).toMatchObject({ id: capture, status: 'TRANSCRIBING', processing_attempts: 1 })
    expect(await tx`SELECT * FROM public.claim_voice_capture(${capture}) WHERE id IS NOT NULL`).toHaveLength(0)
    const segments = tx.json([{ ordinal: 0, start_ms: 0, end_ms: 1000,
      transcript_path: org + '/transcripts/' + key, reasons: ['NO_MATCH'], candidate_ids: [] }])
    await expect(tx.savepoint((sp) => sp`SELECT public.finalize_voice_capture(${capture}, ${randomUUID()}, ${segments}::jsonb)`))
      .rejects.toMatchObject({ message: 'VOICE_CAPTURE_LEASE_EXPIRED' })
    const [result] = await tx`SELECT public.finalize_voice_capture(${capture}, ${claimed.processing_token}, ${segments}::jsonb) AS count`
    expect(result.count).toBe(1)
    const [queue] = await tx`SELECT q.reasons FROM public.voice_assignment_queue q
      JOIN public.voice_segments s ON s.id = q.segment_id WHERE s.capture_id = ${capture}`
    expect(queue.reasons).toEqual(['NO_MATCH'])
    throw rollback
  }).catch((error: unknown) => { if (error !== rollback) throw error })
})

it('przywraca deklarowanego autora po późnym dotarciu początku sesji @REQ: VOICE-RESIDENT-ASSIGN', async () => {
  await sql.begin(async (tx) => {
    const org = randomUUID()
    const user = randomUUID()
    const device = randomUUID()
    const session = randomUUID()
    const first = randomUUID()
    const second = randomUUID()
    await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture sesji')`
    await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data, raw_user_meta_data)
      VALUES (${user}, 'authenticated', 'authenticated',
        jsonb_build_object('role', 'nurse', 'organization_id', ${org}::uuid), '{"full_name":"Łucja Żak"}')`
    await tx`INSERT INTO public.voice_devices (id, organization_id, label, token_hash)
      VALUES (${device}, ${org}, 'Fixture', ${device.replaceAll('-', '').repeat(2)})`
    await tx`INSERT INTO public.voice_captures
      (id, organization_id, source, source_key, storage_path, sha256, device_id, session_id, session_seq, recorded_at)
      VALUES
        (${first}, ${org}, 'DEVICE', ${first}, ${org + '/device/' + first}, ${'a'.repeat(64)}, ${device}, ${session}, 1, now()),
        (${second}, ${org}, 'DEVICE', ${second}, ${org + '/device/' + second}, ${'a'.repeat(64)}, ${device}, ${session}, 2, now())`
    await tx`SET LOCAL ROLE service_role`
    const [later] = await tx`SELECT * FROM public.claim_voice_capture(${second})`
    const segments = tx.json([{ ordinal: 0, start_ms: 0, end_ms: 1000,
      transcript_path: org + '/transcripts/' + second, reasons: ['NO_AUTHOR'], candidate_ids: [] }])
    await tx`SELECT public.finalize_voice_capture(${second}, ${later.processing_token}, ${segments}::jsonb)`
    const [intro] = await tx`SELECT * FROM public.claim_voice_capture(${first})`
    const [context] = await tx`SELECT public.read_voice_capture_context(${first}, ${intro.processing_token}) AS result`
    expect(context.result.staff).toEqual([{ id: user, name: 'Łucja Żak' }])
    await tx`SELECT public.declare_voice_capture_author(${first}, ${intro.processing_token}, ${user})`
    const [assigned] = await tx`SELECT assignment_status, author_id, author_attribution FROM public.voice_segments WHERE capture_id = ${second}`
    expect(assigned).toEqual({ assignment_status: 'FACILITY', author_id: user, author_attribution: 'DECLARED_SESSION' })
    throw rollback
  }).catch((error: unknown) => { if (error !== rollback) throw error })
})
