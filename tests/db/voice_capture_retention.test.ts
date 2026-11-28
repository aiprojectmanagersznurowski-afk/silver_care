import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { OPERATIONAL_REPORT_ENGINE, VOICE_RETENTION } from '@silvercare/contracts/src/generated/voice'
import { parse } from 'dotenv'
import postgres from 'postgres'
import { afterAll, expect, it, vi } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (!['127.0.0.1', 'localhost'].includes(database.hostname)
  || database.username !== 'postgres' || database.pathname !== '/postgres') throw new Error('Local database required')
const sql = postgres(database.toString(), { prepare: false })
const rollback = Symbol('rollback')
const { minDays, ttlDays, maxDays } = VOICE_RETENTION
afterAll(() => sql.end())
type Connection = postgres.Sql | postgres.TransactionSql
async function seedOrganization(db: Connection) {
  const org = randomUUID()
  const user = randomUUID()
  await db`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Test retencji')`
  await db`INSERT INTO auth.users (id, aud, role, raw_app_meta_data) VALUES (${user}, 'authenticated', 'authenticated',
    jsonb_build_object('role', 'org_admin', 'organization_id', ${org}::uuid))`
  return { org, user }
}
async function seedCapture(db: Connection, org: string, user: string, id: string, path: string,
  { age = 0, offset = 0, status = 'RECEIVED' } = {}) {
  await db`INSERT INTO public.voice_captures
    (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at, received_at, status)
    VALUES (${id}, ${org}, 'APP_GENERAL', ${id}, ${path}, ${'a'.repeat(64)}, ${user},
      now(), now() - make_interval(days => ${age}, secs => ${-offset}), ${status})`
}

async function withRollback(action: (tx: postgres.TransactionSql) => Promise<void>) {
  await sql.begin(async (tx) => { await action(tx); throw rollback })
    .catch((error: unknown) => { if (error !== rollback) throw error })
}
async function assumeRetentionRole(tx: postgres.TransactionSql, user: string, org: string,
  role = 'org_admin', aal = 'aal2', impersonatorId?: string) {
  await tx`SET LOCAL ROLE authenticated`
  await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
    sub: user, role: 'authenticated', aal, app_metadata: { role, organization_id: org, impersonator_id: impersonatorId },
  })}, true)`
}

it('zachowuje zatwierdzony transkrypt i bezpiecznie ponawia sprzątanie wygasłego @REQ: VOICE-RETENTION', async () => {
  await withRollback(async (tx) => {
    const { org, user } = await seedOrganization(tx)
    const active = randomUUID()
    const expired = randomUUID()
    const upload = (key: string) => `${org}/app_general/${user}/${key}`
    const uploadPaths = [upload(randomUUID()), upload(randomUUID()), upload(active), `${org}/fixture/${randomUUID()}`]
    const transcript = (capture: string) => `${org}/transcripts/${capture}/${randomUUID()}/0`
    const [draft, committed, other, late] = [active, active, randomUUID(), expired].map(transcript)
    await seedCapture(tx, org, user, active, uploadPaths[2], { status: 'SEGMENTED' })
    await seedCapture(tx, org, user, expired, `${org}/fixture/${expired}`, { age: ttlDays + 1, status: 'SEGMENTED' })
    await tx`INSERT INTO storage.objects (bucket_id, name, created_at)
      SELECT ${VOICE_RETENTION.storageBucket}, path, now() - CASE WHEN path = ANY(${[uploadPaths[0], ...uploadPaths.slice(2)]}::text[])
        THEN make_interval(days => ${ttlDays + 1}) ELSE interval '0 days' END
      FROM unnest(${[draft, committed, ...uploadPaths]}::text[]) AS upload(path)`
    await tx`INSERT INTO public.voice_segments (organization_id, capture_id, ordinal, start_ms, end_ms, transcript_path)
      VALUES (${org}, ${active}, 0, 0, 1000, ${committed})`
    const signature = 'public.queue_abandoned_voice_transcripts(uuid,text[])'
    expect(await tx`SELECT has_function_privilege('authenticated', ${signature}, 'EXECUTE') AS staff,
      has_function_privilege('anon', ${signature}, 'EXECUTE') AS guest`).toEqual([{ staff: false, guest: false }])
    await tx`SET LOCAL ROLE service_role`
    await tx`SELECT public.queue_abandoned_voice_transcripts(${active}, ${[draft, committed, other]}::text[]) FROM generate_series(1, 2)`
    expect(await tx`SELECT path FROM public.voice_storage_deletions WHERE path IN (${draft}, ${committed}, ${other})`)
      .toEqual([{ path: draft }])
    await tx`SELECT public.expire_voice_captures()`
    expect(await tx`SELECT path FROM public.voice_storage_deletions WHERE path = ANY(${uploadPaths}::text[])`).toEqual([{ path: uploadPaths[0] }])
    expect(await tx`SELECT path FROM public.voice_storage_deletions WHERE path = ${late}`).toEqual([])
    await tx`RESET ROLE`
    await tx`INSERT INTO storage.objects (bucket_id, name) VALUES (${VOICE_RETENTION.storageBucket}, ${late})`
    await tx`SET LOCAL ROLE service_role`
    const claim = () => tx`SELECT lease_token FROM public.claim_voice_storage_deletions() WHERE path = ${late}`
    const [claimed] = await claim()
    expect(claimed.lease_token).toEqual(expect.any(String))
    expect(await claim()).toEqual([])
    await tx`RESET ROLE`
    await tx`UPDATE public.voice_storage_deletions SET leased_until = now() - interval '1 second' WHERE path = ${late}`
    await tx`SET LOCAL ROLE service_role`
    const [retry] = await claim()
    expect(retry.lease_token).toEqual(expect.any(String))
    expect(retry.lease_token).not.toBe(claimed.lease_token)
    await tx`SELECT public.finish_voice_storage_deletions(${claimed.lease_token})`
    expect(await tx`SELECT lease_token FROM public.voice_storage_deletions WHERE path = ${late}`).toEqual([retry])
  })
})

it('stosuje retencję placówki i audytuje tylko uprawnione zmiany @REQ: VOICE-RETENTION @REQ: SEC-MFA-STAFF @REQ: ORG-ISOLATION', async () => {
  await withRollback(async (tx) => {
    const short = await seedOrganization(tx)
    const defaultPolicy = await seedOrganization(tx)
    const long = await seedOrganization(tx)
    const change = (connection: Connection, days: number | null, org = short.org) =>
      connection`SELECT public.set_voice_capture_retention(${org}, ${days})`
    const denied = (days: number | null, org = short.org, code = '42501') =>
      expect(tx.savepoint((sp) => change(sp, days, org))).rejects.toMatchObject({ code })
    await assumeRetentionRole(tx, short.user, short.org)
    await change(tx, minDays)
    await change(tx, minDays)
    for (const days of [minDays - 1, maxDays + 1, null]) await denied(days, short.org, '22023')
    await denied(minDays, long.org)
    for (const role of ['nurse', 'family']) {
      await assumeRetentionRole(tx, short.user, short.org, role)
      await denied(maxDays)
    }
    await assumeRetentionRole(tx, short.user, short.org, 'org_admin', 'aal2', long.user)
    await denied(maxDays)
    await tx`RESET ROLE`
    expect(await tx`SELECT private.staff_mfa_disabled_for_tests() AS disabled`).toEqual([{ disabled: false }])
    await assumeRetentionRole(tx, short.user, short.org, 'org_admin', 'aal1')
    await denied(maxDays)
    expect(await tx`SELECT retention_days FROM public.voice_retention_settings WHERE organization_id = ${short.org}`).toHaveLength(0)
    await assumeRetentionRole(tx, defaultPolicy.user, defaultPolicy.org)
    await change(tx, ttlDays, defaultPolicy.org)
    await assumeRetentionRole(tx, short.user, short.org, 'super_admin')
    await change(tx, maxDays, long.org)
    await assumeRetentionRole(tx, short.user, short.org)
    expect(await tx`SELECT organization_id FROM public.voice_retention_settings WHERE organization_id IN (${short.org}, ${long.org})`)
      .toEqual([{ organization_id: short.org }])
    await tx`RESET ROLE`
    expect(await tx`SELECT organization_id, retention_days FROM public.voice_retention_settings
      WHERE organization_id IN (${short.org}, ${defaultPolicy.org}, ${long.org}) ORDER BY retention_days`).toEqual([
      { organization_id: short.org, retention_days: minDays }, { organization_id: long.org, retention_days: maxDays },
    ])
    expect(await tx`SELECT organization_id, performed_by, payload FROM public.audit_logs
      WHERE organization_id IN (${short.org}, ${defaultPolicy.org}, ${long.org})
        AND action = 'VOICE_CAPTURE_RETENTION_CHANGED' ORDER BY (payload->>'retention_days')::integer`).toEqual([
      { organization_id: short.org, performed_by: short.user, payload: { previous_days: ttlDays, retention_days: minDays } },
      { organization_id: long.org, performed_by: short.user, payload: { previous_days: ttlDays, retention_days: maxDays } },
    ])
  })
})

it('stosuje dokładny termin 7, 30 i 90 dni, zachowując raporty i zredagowane dane @REQ: VOICE-RETENTION', async () => {
  await withRollback(async (tx) => {
    const fixtures: { id: string; paths: string[]; expired: boolean }[] = []
    const event = randomUUID()
    const report = randomUUID()
    const category = OPERATIONAL_REPORT_ENGINE.defaultCategories[0].code
    for (const age of [minDays, ttlDays, maxDays]) {
      const { org, user } = await seedOrganization(tx)
      if (age !== ttlDays) await tx`INSERT INTO public.voice_retention_settings (organization_id, retention_days) VALUES (${org}, ${age})`
      const [{ id: resident }] = await tx`INSERT INTO public.residents (organization_id, first_name, last_name)
        VALUES (${org}, 'Test', 'Retencja') RETURNING id`
      for (const offset of [-1, 0, 1]) {
        const id = randomUUID()
        const path = `${org}/app_general/${user}/${id}`
        const transcript = `${org}/transcripts/${id}/test/0`
        fixtures.push({ id, paths: [path, transcript], expired: offset < 0 })
        await seedCapture(tx, org, user, id, path, { age, offset })
        await tx`INSERT INTO public.voice_segments (id, organization_id, capture_id, ordinal, start_ms, end_ms, transcript_path)
          VALUES (${id}, ${org}, ${id}, 0, 0, 1000, ${transcript})`
        await tx`INSERT INTO public.voice_assignment_queue (segment_id, organization_id, reasons) VALUES (${id}, ${org}, ARRAY['NO_MATCH'])`
        await tx`INSERT INTO public.voice_draft_notes (id, resident_id, nurse_id, audio_url, created_at)
          SELECT id, ${resident}, ${user}, 'local-only', received_at FROM public.voice_captures WHERE id = ${id}`
        if (age === minDays && offset < 0) {
          await tx`WITH daily AS (INSERT INTO public.daily_reports (id, resident_id, author_id, approved_by, status)
            VALUES (${report}, ${resident}, ${user}, ${user}, 'PUBLISHED')),
          log AS (INSERT INTO public.daily_logs (id, resident_id, nurse_id) VALUES (${report}, ${resident}, ${user})),
          sanitized AS (INSERT INTO public.voice_sanitized_events (id, organization_id, segment_id, capture_source, scope,
            author_id, sanitized_text, matched_categories, recorded_at, metadata) VALUES (${event}, ${org}, ${id}, 'APP_GENERAL',
            'facility', ${user}, 'Zdarzenie testowe', ARRAY[${category}], now(), '{"pipeline_stage":"CLASSIFY"}'))
          INSERT INTO public.operational_reports (id, organization_id, category_code, period_start, period_end, source_event_ids,
            content, status, ai_model, ai_prompt_version, ai_generated_at, approved_by, approved_at) VALUES (${report}, ${org},
            ${category}, now() - interval '1 day', now(), ARRAY[${event}::uuid], '{}', 'APPROVED', 'test', 'test', now(), ${user}, now())`
        }
      }
    }
    const [{ batches }] = await tx`SELECT 1 + GREATEST((SELECT count(*) FROM public.voice_captures),
      (SELECT count(*) FROM public.voice_draft_notes)) / 50 AS batches`
    await tx`SET LOCAL ROLE service_role`
    await tx`SELECT public.expire_voice_captures() FROM generate_series(1, ${batches}::bigint)`
    await tx`RESET ROLE`
    for (const { id, paths, expired } of fixtures) {
      const remaining = expired ? 0 : 1
      expect(await tx`SELECT (SELECT count(*)::integer FROM public.voice_captures WHERE id = ${id}) AS captures,
        (SELECT count(*)::integer FROM public.voice_segments WHERE id = ${id}) AS segments,
        (SELECT count(*)::integer FROM public.voice_draft_notes WHERE id = ${id}) AS drafts,
        (SELECT count(*)::integer FROM public.voice_assignment_queue WHERE segment_id = ${id}) AS assignments,
        (SELECT count(*)::integer FROM public.voice_storage_deletions WHERE path = ANY(${paths}::text[])) AS files`)
        .toEqual([{ captures: remaining, segments: remaining, drafts: remaining, assignments: remaining, files: expired ? 2 : 0 }])
    }
    expect(await tx`SELECT status FROM public.daily_reports WHERE id = ${report}`).toEqual([{ status: 'PUBLISHED' }])
    expect(await tx`SELECT id FROM public.daily_logs WHERE id = ${report}`).toHaveLength(1)
    expect(await tx`SELECT segment_id FROM public.voice_sanitized_events WHERE id = ${event}`).toEqual([{ segment_id: null }])
    expect(await tx`SELECT status, source_event_ids FROM public.operational_reports WHERE id = ${report}`)
      .toEqual([{ status: 'APPROVED', source_event_ids: [event] }])
  })
})

// Promotion CI provisions this Supabase project for the test job. Local runs opt in with their own disposable project.
const storageWorkdir = process.env.SC_VOICE_RETENTION_STORAGE_WORKDIR
  || (process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_TEMP ? join(process.env.RUNNER_TEMP, 'candidate') : '')
it.runIf(Boolean(storageWorkdir))('usuwa wygasłe pliki, potwierdza kolejkę i zachowuje nowsze audio @REQ: VOICE-RETENTION', async () => {
    const status = parse(execFileSync('supabase', ['status', '--workdir', storageWorkdir, '-o', 'env'],
      { stdio: ['ignore', 'pipe', 'ignore'] }))
    const api = new URL(status.API_URL)
    const stackDb = new URL(status.DB_URL)
    if (!['127.0.0.1', 'localhost'].includes(api.hostname) || stackDb.host !== database.host || !status.SERVICE_ROLE_KEY) {
      throw new Error('Storage and SQL must use the same disposable local Supabase stack')
    }
    expect(await sql`SELECT EXISTS (SELECT 1 FROM public.voice_captures
      UNION ALL SELECT 1 FROM public.voice_storage_deletions UNION ALL SELECT 1 FROM public.voice_draft_notes
      UNION ALL SELECT 1 FROM private.voice_device_uploads UNION ALL SELECT 1 FROM public.operational_reports
      UNION ALL SELECT 1 FROM public.voice_sanitized_events
      UNION ALL SELECT 1 FROM storage.objects WHERE bucket_id = ${VOICE_RETENTION.storageBucket}) AS has_data`).toEqual([{ has_data: false }])
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', api.href)
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', status.SERVICE_ROLE_KEY)
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { removeExpiredVoiceStorage } = await import('@/lib/voice-maintenance-worker')
    const storage = createAdminClient().storage.from(VOICE_RETENTION.storageBucket)
    const { org, user } = await seedOrganization(sql)
    const expired = randomUUID()
    const retained = randomUUID()
    const expiredAudio = `${org}/fixture/${expired}`
    const expiredTranscript = `${org}/transcripts/${expired}/fixture/0`
    const freshAudio = `${org}/fixture/${retained}`
    const paths = [expiredAudio, expiredTranscript, freshAudio]
    try {
      await sql`INSERT INTO public.voice_retention_settings (organization_id, retention_days) VALUES (${org}, ${minDays})`
      await seedCapture(sql, org, user, expired, expiredAudio, { age: minDays + 1 })
      await seedCapture(sql, org, user, retained, freshAudio)
      for (const path of paths) {
        expect((await storage.upload(path, new Uint8Array([1, 2, 3]))).error).toBeNull()
        expect((await storage.download(path)).data).not.toBeNull()
      }
      expect(await sql`SELECT name FROM storage.objects WHERE bucket_id = ${VOICE_RETENTION.storageBucket}
        AND name = ANY(${paths}::text[])`).toHaveLength(paths.length)
      await sql`INSERT INTO public.voice_segments
        (organization_id, capture_id, ordinal, start_ms, end_ms, transcript_path)
        VALUES (${org}, ${expired}, 0, 0, 1000, ${expiredTranscript})`
      expect(await sql`SELECT path FROM public.voice_storage_deletions WHERE path = ANY(${paths}::text[])`).toHaveLength(0)
      expect(await removeExpiredVoiceStorage()).toBe('processed')
      for (const path of [expiredAudio, expiredTranscript]) {
        expect(await storage.download(path)).toMatchObject({ data: null, error: { message: expect.stringMatching(/not found/i) } })
      }
      expect((await storage.download(freshAudio)).data).not.toBeNull()
      expect(await sql`SELECT path FROM public.voice_storage_deletions WHERE path = ANY(${paths}::text[])`).toHaveLength(0)
      expect(await sql`SELECT id FROM public.voice_captures WHERE organization_id = ${org}`).toEqual([{ id: retained }])
    } finally {
      vi.unstubAllEnvs()
      await storage.remove(paths)
      await sql`DELETE FROM public.voice_captures WHERE organization_id = ${org}`
      await sql`DELETE FROM public.voice_storage_deletions WHERE path = ANY(${paths}::text[])`
      await sql`DELETE FROM auth.users WHERE id = ${user}`
      await sql`DELETE FROM public.voice_retention_settings WHERE organization_id = ${org}`
    }
  })
