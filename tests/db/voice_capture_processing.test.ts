import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.port !== '54322'
  || database.username !== 'postgres' || database.pathname !== '/postgres') throw new Error('Local database required')
const sql = postgres(database.toString(), { prepare: false })
const rollback = Symbol('rollback')
afterAll(() => sql.end())

it('atomowo zapisuje fragmenty pod aktualną dzierżawą i odkłada wyjątki @REQ: VOICE-RESIDENT-ASSIGN', async () => {
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
