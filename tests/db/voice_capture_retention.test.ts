import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (!['127.0.0.1', 'localhost'].includes(database.hostname)
  || database.username !== 'postgres' || database.pathname !== '/postgres') throw new Error('Local database required')
const sql = postgres(database.toString(), { prepare: false })
const rollback = Symbol('rollback')
afterAll(() => sql.end())

it('zleca sprzątanie transkryptu zapisanego po wygaśnięciu źródła i zachowuje ponowienie @REQ: VOICE-RETENTION', async () => {
  await sql.begin(async (tx) => {
    const org = randomUUID()
    const user = randomUUID()
    const capture = randomUUID()
    const transcript = `${org}/transcripts/${capture}/${randomUUID()}/${randomUUID()}`
    await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture późnego zapisu')`
    await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
      VALUES (${user}, 'authenticated', 'authenticated',
        jsonb_build_object('role', 'org_admin', 'organization_id', ${org}::uuid))`
    await tx`INSERT INTO public.voice_captures
      (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at, received_at, status)
      VALUES (${capture}, ${org}, 'APP_GENERAL', ${capture}, ${org + '/fixture/' + capture}, ${'a'.repeat(64)}, ${user},
        now() - interval '32 days', now() - interval '31 days', 'SEGMENTED')`

    await tx`SET LOCAL ROLE service_role`
    await tx`SELECT public.expire_voice_captures()`
    expect(await tx`SELECT id FROM public.voice_captures WHERE id = ${capture}`).toEqual([])
    expect(await tx`SELECT path FROM public.voice_storage_deletions WHERE path = ${transcript}`).toEqual([])

    await tx`RESET ROLE`
    await tx`INSERT INTO storage.objects (bucket_id, name) VALUES ('voice-recordings', ${transcript})`
    await tx`SET LOCAL ROLE service_role`
    const [claimed] = await tx`SELECT path, lease_token FROM public.claim_voice_storage_deletions()
      WHERE path = ${transcript}`
    expect(claimed).toMatchObject({ path: transcript, lease_token: expect.any(String) })
    expect(await tx`SELECT path FROM public.claim_voice_storage_deletions() WHERE path = ${transcript}`).toEqual([])

    await tx`RESET ROLE`
    await tx`UPDATE public.voice_storage_deletions SET leased_until = now() - interval '1 second'
      WHERE path = ${transcript}`
    await tx`SET LOCAL ROLE service_role`
    const [retry] = await tx`SELECT lease_token FROM public.claim_voice_storage_deletions() WHERE path = ${transcript}`
    expect(retry?.lease_token).toEqual(expect.any(String))
    expect(retry.lease_token).not.toBe(claimed.lease_token)
    await tx`SELECT public.finish_voice_storage_deletions(${claimed.lease_token})`
    expect(await tx`SELECT lease_token FROM public.voice_storage_deletions WHERE path = ${transcript}`).toEqual([retry])
    throw rollback
  }).catch((error: unknown) => { if (error !== rollback) throw error })
})

it('zachowuje transkrypt zatwierdzony mimo utraty odpowiedzi workera @REQ: VOICE-RETENTION', async () => {
  await sql.begin(async (tx) => {
    const org = randomUUID()
    const user = randomUUID()
    const capture = randomUUID()
    const draft = `${org}/transcripts/${capture}/${randomUUID()}/0`
    const committed = `${org}/transcripts/${capture}/${randomUUID()}/0`
    const other = `${org}/transcripts/${randomUUID()}/${randomUUID()}/0`
    await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture utraconej odpowiedzi')`
    await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
      VALUES (${user}, 'authenticated', 'authenticated',
        jsonb_build_object('role', 'org_admin', 'organization_id', ${org}::uuid))`
    await tx`INSERT INTO public.voice_captures
      (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at, status)
      VALUES (${capture}, ${org}, 'APP_GENERAL', ${capture}, ${org + '/fixture/' + capture},
        ${'a'.repeat(64)}, ${user}, now(), 'SEGMENTED')`
    const paths = [draft, committed, other]
    await tx`INSERT INTO storage.objects (bucket_id, name)
      SELECT 'voice-recordings', path FROM unnest(${[draft, committed]}::text[]) AS p(path)`
    await tx`INSERT INTO public.voice_segments
      (organization_id, capture_id, ordinal, start_ms, end_ms, transcript_path)
      VALUES (${org}, ${capture}, 0, 0, 1000, ${committed})`
    const [access] = await tx`SELECT
      has_function_privilege('authenticated', 'public.queue_abandoned_voice_transcripts(uuid,text[])', 'EXECUTE') AS staff,
      has_function_privilege('anon', 'public.queue_abandoned_voice_transcripts(uuid,text[])', 'EXECUTE') AS guest`
    expect(access).toEqual({ staff: false, guest: false })
    await tx`SET LOCAL ROLE service_role`
    await tx`SELECT public.queue_abandoned_voice_transcripts(${capture}, ${paths}::text[])`
    await tx`SELECT public.queue_abandoned_voice_transcripts(${capture}, ${paths}::text[])`
    expect(await tx`SELECT path FROM public.voice_storage_deletions WHERE path = ANY(${paths}::text[])`)
      .toEqual([{ path: draft }])
    throw rollback
  }).catch((error: unknown) => { if (error !== rollback) throw error })
})

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

it('kolejkuje tylko wygasłe niepowiązane pliki z nagrań ogólnych @REQ: VOICE-RETENTION', async () => {
  await sql.begin(async (tx) => {
    const org = randomUUID()
    const user = randomUUID()
    const resident = randomUUID()
    const capture = randomUUID()
    const path = (key: string) => org + '/app_general/' + user + '/' + key
    const expired = path(randomUUID())
    const current = path(randomUUID())
    const linked = path(capture)
    const unrelated = org + '/fixture/' + randomUUID()
    await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture retencji uploadu')`
    await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
      VALUES (${user}, 'authenticated', 'authenticated',
        jsonb_build_object('role', 'org_admin', 'organization_id', ${org}::uuid))`
    await tx`INSERT INTO public.residents (id, organization_id, first_name, last_name)
      VALUES (${resident}, ${org}, 'Test', 'Retencja')`
    await tx`INSERT INTO public.voice_captures
      (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at)
      VALUES (${capture}, ${org}, 'APP_GENERAL', ${capture}, ${linked}, ${'a'.repeat(64)}, ${user}, now())`
    const [draft] = await tx`INSERT INTO public.voice_draft_notes (resident_id, nurse_id, audio_url, created_at)
      VALUES (${resident}, ${user}, 'local-only', now() - interval '32 days') RETURNING id`
    await tx`INSERT INTO storage.objects (bucket_id, name, created_at) VALUES
      ('voice-recordings', ${expired}, now() - interval '31 days'),
      ('voice-recordings', ${linked}, now() - interval '31 days'),
      ('voice-recordings', ${unrelated}, now() - interval '31 days'),
      ('voice-recordings', ${current}, now())`
    await tx`SET LOCAL ROLE service_role`
    await tx`SELECT public.expire_voice_captures()`
    await tx`SELECT public.expire_voice_captures()`
    expect(await tx`SELECT path FROM public.voice_storage_deletions
      WHERE path IN (${expired}, ${linked}, ${unrelated}, ${current})`).toEqual([{ path: expired }])
    expect(await tx`SELECT id FROM public.voice_draft_notes WHERE id = ${draft.id}`).toHaveLength(0)
    throw rollback
  }).catch((error: unknown) => { if (error !== rollback) throw error })
})
