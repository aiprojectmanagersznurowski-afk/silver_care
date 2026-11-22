import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.port !== '54322'
  || database.username !== 'postgres' || database.pathname !== '/postgres') throw new Error('Local database required')
const sql = postgres(database.toString(), { prepare: false })
const rollback = Symbol('rollback')
afterAll(() => sql.end())

it('wygasza źródło po retencji i zleca usunięcie nagrania oraz transkryptu w Storage @REQ: VOICE-RETENTION', async () => {
  await sql.begin(async (tx) => {
    const org = randomUUID()
    const user = randomUUID()
    const capture = randomUUID()
    const path = org + '/fixture/' + capture
    const transcript = org + '/transcripts/' + capture + '/fixture/01'
    await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture retencji')`
    await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
      VALUES (${user}, 'authenticated', 'authenticated',
        jsonb_build_object('role', 'org_admin', 'organization_id', ${org}::uuid))`
    await tx`INSERT INTO public.voice_captures
      (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at, received_at)
      VALUES (${capture}, ${org}, 'APP_GENERAL', ${capture}, ${path}, ${'a'.repeat(64)}, ${user},
        now() - interval '34 days', now() - interval '31 days')`
    await tx`INSERT INTO public.voice_segments
      (organization_id, capture_id, ordinal, start_ms, end_ms, transcript_path)
      VALUES (${org}, ${capture}, 0, 0, 1000, ${transcript})`
    await tx`SET LOCAL ROLE service_role`
    await tx`SELECT public.expire_voice_captures()`
    expect(await tx`SELECT id FROM public.voice_captures WHERE id = ${capture}`).toHaveLength(0)
    const paths = await tx`SELECT path FROM public.voice_storage_deletions WHERE path IN (${path}, ${transcript}) ORDER BY path`
    expect(paths.map(({ path }) => path)).toEqual([path, transcript])
    throw rollback
  }).catch((error: unknown) => { if (error !== rollback) throw error })
})
