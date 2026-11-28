import { randomUUID } from 'node:crypto'
import { OPERATIONAL_REPORT_ENGINE, VOICE_RETENTION } from '@silvercare/contracts/src/generated/voice'
import postgres from 'postgres'
import { afterAll, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (!['127.0.0.1', 'localhost'].includes(database.hostname)
  || database.username !== 'postgres' || database.pathname !== '/postgres') throw new Error('Local database required')
const sql = postgres(database.toString(), { prepare: false })
const rollback = Symbol('rollback')
const { minDays, ttlDays, maxDays } = VOICE_RETENTION
afterAll(() => sql.end())

async function assumeRetentionRole(tx: postgres.TransactionSql, user: string, org: string,
  role = 'org_admin', aal = 'aal2', impersonatorId?: string) {
  await tx`SET LOCAL ROLE authenticated`
  await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
    sub: user, role: 'authenticated', aal, app_metadata: { role, organization_id: org, impersonator_id: impersonatorId },
  })}, true)`
}

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

it('stosuje retencję placówki i audytuje tylko uprawnione zmiany @REQ: VOICE-RETENTION @REQ: SEC-MFA-STAFF @REQ: ORG-ISOLATION', async () => {
  await sql.begin(async (tx) => {
    const policies = [minDays, ttlDays, maxDays].map((days) => ({ days, org: randomUUID(), user: randomUUID() }))
    const [short, defaultPolicy, long] = policies
    for (const { org, user } of policies) {
      await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Test ustawienia retencji')`
      await tx`INSERT INTO auth.users (id, raw_app_meta_data)
        VALUES (${user}, jsonb_build_object('role', 'org_admin', 'organization_id', ${org}::uuid))`
    }

    await assumeRetentionRole(tx, short.user, short.org)
    await tx`SELECT public.set_voice_capture_retention(${short.org}, ${minDays})`
    await tx`SELECT public.set_voice_capture_retention(${short.org}, ${minDays})`
    for (const days of [minDays - 1, maxDays + 1, null]) {
      await expect(tx.savepoint((sp) => sp`SELECT public.set_voice_capture_retention(${short.org}, ${days})`))
        .rejects.toMatchObject({ code: '22023' })
    }
    await expect(tx.savepoint((sp) => sp`SELECT public.set_voice_capture_retention(${long.org}, ${minDays})`))
      .rejects.toMatchObject({ code: '42501' })

    for (const role of ['nurse', 'family']) {
      await assumeRetentionRole(tx, short.user, short.org, role)
      await expect(tx.savepoint((sp) => sp`SELECT public.set_voice_capture_retention(${short.org}, ${maxDays})`))
        .rejects.toMatchObject({ code: '42501' })
    }
    await assumeRetentionRole(tx, short.user, short.org, 'org_admin', 'aal2', long.user)
    await expect(tx.savepoint((sp) => sp`SELECT public.set_voice_capture_retention(${short.org}, ${maxDays})`))
      .rejects.toMatchObject({ code: '42501', message: 'IMPERSONATION_WRITE_FORBIDDEN' })

    await tx`RESET ROLE`
    await tx`CREATE OR REPLACE FUNCTION private.staff_mfa_disabled_for_tests() RETURNS boolean
      LANGUAGE sql STABLE SET search_path = '' RETURN false`
    await assumeRetentionRole(tx, short.user, short.org, 'org_admin', 'aal1')
    await expect(tx.savepoint((sp) => sp`SELECT public.set_voice_capture_retention(${short.org}, ${maxDays})`))
      .rejects.toMatchObject({ code: '42501', message: 'MFA_AAL2_REQUIRED' })
    expect(await tx`SELECT retention_days FROM public.voice_retention_settings WHERE organization_id = ${short.org}`)
      .toHaveLength(0)

    await assumeRetentionRole(tx, defaultPolicy.user, defaultPolicy.org)
    await tx`SELECT public.set_voice_capture_retention(${defaultPolicy.org}, ${ttlDays})`
    await assumeRetentionRole(tx, short.user, short.org, 'super_admin')
    await tx`SELECT public.set_voice_capture_retention(${long.org}, ${maxDays})`
    await assumeRetentionRole(tx, short.user, short.org)
    expect(await tx`SELECT organization_id FROM public.voice_retention_settings WHERE organization_id IN (${short.org}, ${long.org})`)
      .toEqual([{ organization_id: short.org }])
    await tx`RESET ROLE`

    expect(await tx`SELECT organization_id, retention_days FROM public.voice_retention_settings
      WHERE organization_id IN (${short.org}, ${defaultPolicy.org}, ${long.org})`).toEqual(expect.arrayContaining([
      { organization_id: short.org, retention_days: minDays }, { organization_id: long.org, retention_days: maxDays },
    ]))
    expect(await tx`SELECT organization_id, performed_by, payload FROM public.audit_logs
      WHERE organization_id IN (${short.org}, ${defaultPolicy.org}, ${long.org})
        AND action = 'VOICE_CAPTURE_RETENTION_CHANGED'`).toEqual(expect.arrayContaining([
      { organization_id: short.org, performed_by: short.user, payload: { previous_days: ttlDays, retention_days: minDays } },
      { organization_id: long.org, performed_by: short.user, payload: { previous_days: ttlDays, retention_days: maxDays } },
    ]))
    expect(await tx`SELECT retention_days FROM public.voice_retention_settings WHERE organization_id = ${defaultPolicy.org}`)
      .toHaveLength(0)
    expect(await tx`SELECT action FROM public.audit_logs
      WHERE organization_id IN (${short.org}, ${defaultPolicy.org}, ${long.org})
        AND action = 'VOICE_CAPTURE_RETENTION_CHANGED'`).toHaveLength(2)

    const report = randomUUID()
    const dailyLog = randomUUID()
    const event = randomUUID()
    const operational = randomUUID()
    const category = OPERATIONAL_REPORT_ENGINE.defaultCategories[0].code
    const fixtures = []
    for (const { org, user, days } of policies) {
      const resident = randomUUID()
      await tx`INSERT INTO public.residents (id, organization_id, first_name, last_name)
        VALUES (${resident}, ${org}, 'Test', 'Retencja')`
      if (org === short.org) {
        await tx`INSERT INTO public.daily_reports (id, resident_id, author_id, approved_by, status)
          VALUES (${report}, ${resident}, ${user}, ${user}, 'PUBLISHED')`
        await tx`INSERT INTO public.daily_logs (id, resident_id, nurse_id) VALUES (${dailyLog}, ${resident}, ${user})`
      }
      for (const secondsFromCutoff of [-1, 0, 1]) {
        const id = randomUUID()
        const path = `${org}/fixture/${id}`
        const transcript = `${org}/transcripts/${id}/fixture/0`
        const received = tx`now() - make_interval(days => ${days}, secs => ${-secondsFromCutoff})`
        await tx`INSERT INTO public.voice_captures
          (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at, received_at)
          VALUES (${id}, ${org}, 'APP_GENERAL', ${id}, ${path}, ${'a'.repeat(64)}, ${user}, ${received}, ${received})`
        await tx`INSERT INTO public.voice_segments
          (id, organization_id, capture_id, ordinal, start_ms, end_ms, transcript_path)
          VALUES (${id}, ${org}, ${id}, 0, 0, 1000, ${transcript})`
        await tx`INSERT INTO public.voice_assignment_queue (segment_id, organization_id, reasons)
          VALUES (${id}, ${org}, ARRAY['NO_MATCH'])`
        await tx`INSERT INTO public.voice_draft_notes (id, resident_id, nurse_id, audio_url, created_at)
          VALUES (${id}, ${resident}, ${user}, 'local-only', ${received})`
        if (org === short.org && secondsFromCutoff < 0) {
          await tx`INSERT INTO public.voice_sanitized_events (id, organization_id, segment_id, capture_source,
            scope, author_id, sanitized_text, matched_categories, recorded_at, metadata)
            VALUES (${event}, ${org}, ${id}, 'APP_GENERAL', 'facility', ${user}, 'Zdarzenie testowe',
              ARRAY[${category}], ${received}, '{"pipeline_stage":"CLASSIFY"}')`
          await tx`INSERT INTO public.operational_reports (id, organization_id, category_code,
            period_start, period_end, source_event_ids, content, status, ai_model, ai_prompt_version,
            ai_generated_at, approved_by, approved_at)
            VALUES (${operational}, ${org}, ${category}, now() - interval '1 day', now(), ARRAY[${event}::uuid],
              '{}', 'APPROVED', 'fixture', 'fixture', now(), ${user}, now())`
        }
        fixtures.push({ id, path, transcript, expired: secondsFromCutoff < 0 })
      }
    }

    await tx`SET LOCAL ROLE service_role`
    await tx`SELECT public.expire_voice_captures()`
    await tx`SELECT public.cleanup_expired_operational_reports(${short.org})`
    await tx`RESET ROLE`
    const ids = fixtures.map(({ id }) => id)
    const kept = fixtures.filter(({ expired }) => !expired).map(({ id }) => id).sort()
    expect((await tx`SELECT id FROM public.voice_captures WHERE id = ANY(${ids}::uuid[]) ORDER BY id`).map(({ id }) => id))
      .toEqual(kept)
    expect((await tx`SELECT id FROM public.voice_segments WHERE id = ANY(${ids}::uuid[]) ORDER BY id`).map(({ id }) => id))
      .toEqual(kept)
    expect((await tx`SELECT segment_id AS id FROM public.voice_assignment_queue WHERE segment_id = ANY(${ids}::uuid[]) ORDER BY segment_id`).map(({ id }) => id))
      .toEqual(kept)
    expect((await tx`SELECT id FROM public.voice_draft_notes WHERE id = ANY(${ids}::uuid[]) ORDER BY id`).map(({ id }) => id))
      .toEqual(kept)
    expect((await tx`SELECT path FROM public.voice_storage_deletions
      WHERE path = ANY(${fixtures.flatMap(({ path, transcript }) => [path, transcript])}::text[]) ORDER BY path`).map(({ path }) => path))
      .toEqual(fixtures.filter(({ expired }) => expired).flatMap(({ path, transcript }) => [path, transcript]).sort())
    expect(await tx`SELECT id, status FROM public.daily_reports WHERE id = ${report}`).toEqual([{ id: report, status: 'PUBLISHED' }])
    expect(await tx`SELECT id FROM public.daily_logs WHERE id = ${dailyLog}`).toEqual([{ id: dailyLog }])
    expect(await tx`SELECT id, segment_id FROM public.voice_sanitized_events WHERE id = ${event}`)
      .toEqual([{ id: event, segment_id: null }])
    expect(await tx`SELECT id, status, source_event_ids FROM public.operational_reports WHERE id = ${operational}`)
      .toEqual([{ id: operational, status: 'APPROVED', source_event_ids: [event] }])
    throw rollback
  }).catch((error: unknown) => { if (error !== rollback) throw error })
})

it.runIf(process.env.SC_VOICE_RETENTION_STORAGE_TEST === '1')(
  'usuwa fizycznie przeterminowane audio i transkrypt, potwierdza kolejkę i zachowuje nowsze audio @REQ: VOICE-RETENTION', async () => {
    const apiUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '')
    if (!['127.0.0.1', 'localhost'].includes(apiUrl.hostname)) throw new Error('Local Storage required')
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { removeExpiredVoiceStorage } = await import('@/lib/voice-maintenance-worker')
    const storage = createAdminClient().storage.from(VOICE_RETENTION.storageBucket)
    const org = randomUUID()
    const user = randomUUID()
    const expired = randomUUID()
    const retained = randomUUID()
    const expiredAudio = `${org}/fixture/${expired}`
    const expiredTranscript = `${org}/transcripts/${expired}/fixture/0`
    const freshAudio = `${org}/fixture/${retained}`
    const paths = [expiredAudio, expiredTranscript, freshAudio]

    try {
      await sql`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Test fizycznego usuwania nagrań')`
      await sql`INSERT INTO auth.users (id, raw_app_meta_data)
        VALUES (${user}, jsonb_build_object('role', 'org_admin', 'organization_id', ${org}::uuid))`
      await sql`INSERT INTO public.voice_retention_settings (organization_id, retention_days) VALUES (${org}, ${minDays})`
      for (const path of paths) {
        expect((await storage.upload(path, new Uint8Array([1, 2, 3]))).error).toBeNull()
        expect((await storage.download(path)).data).not.toBeNull()
      }
      await sql`INSERT INTO public.voice_captures
        (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at, received_at)
        VALUES (${expired}, ${org}, 'APP_GENERAL', ${expired}, ${expiredAudio}, ${'a'.repeat(64)}, ${user},
          now(), now() - make_interval(days => ${minDays}) - interval '1 minute'),
        (${retained}, ${org}, 'APP_GENERAL', ${retained}, ${freshAudio}, ${'a'.repeat(64)}, ${user}, now(), now())`
      await sql`INSERT INTO public.voice_segments
        (organization_id, capture_id, ordinal, start_ms, end_ms, transcript_path)
        VALUES (${org}, ${expired}, 0, 0, 1000, ${expiredTranscript})`

      expect(await removeExpiredVoiceStorage()).toBe('processed')
      for (const path of [expiredAudio, expiredTranscript]) {
        const missing = await storage.download(path)
        expect(missing.data).toBeNull()
        expect(missing.error?.message).toMatch(/not found/i)
      }
      expect((await storage.download(freshAudio)).data).not.toBeNull()
      expect(await sql`SELECT path FROM public.voice_storage_deletions WHERE path = ANY(${paths}::text[])`).toHaveLength(0)
      expect(await sql`SELECT id FROM public.voice_captures WHERE organization_id = ${org}`).toEqual([{ id: retained }])
    } finally {
      await storage.remove(paths)
      await sql`DELETE FROM public.voice_captures WHERE organization_id = ${org}`
      await sql`DELETE FROM public.voice_storage_deletions WHERE path = ANY(${paths}::text[])`
      await sql`DELETE FROM auth.users WHERE id = ${user}`
      await sql`DELETE FROM public.organizations o WHERE o.id = ${org}
        AND NOT EXISTS (SELECT 1 FROM public.audit_logs a WHERE a.organization_id = o.id)`
    }
  })
