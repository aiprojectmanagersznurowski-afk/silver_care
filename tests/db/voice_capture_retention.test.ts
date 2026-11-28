import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { VOICE_RETENTION } from '@silvercare/contracts/src/generated/voice'
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
  { age = 0, recordedAge = age, status = 'RECEIVED' } = {}) {
  await db`INSERT INTO public.voice_captures
    (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at, received_at, status)
    VALUES (${id}, ${org}, 'APP_GENERAL', ${id}, ${path}, ${'a'.repeat(64)}, ${user},
      now() - make_interval(days => ${recordedAge}), now() - make_interval(days => ${age}), ${status})`
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

it('zleca sprzątanie transkryptu zapisanego po wygaśnięciu źródła i zachowuje ponowienie @REQ: VOICE-RETENTION', async () => {
  await withRollback(async (tx) => {
    const { org, user } = await seedOrganization(tx)
    const capture = randomUUID()
    const transcript = `${org}/transcripts/${capture}/${randomUUID()}/${randomUUID()}`
    await seedCapture(tx, org, user, capture, `${org}/fixture/${capture}`, { age: 31, recordedAge: 32, status: 'SEGMENTED' })

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
  })
})

it('zachowuje transkrypt zatwierdzony mimo utraty odpowiedzi workera @REQ: VOICE-RETENTION', async () => {
  await withRollback(async (tx) => {
    const { org, user } = await seedOrganization(tx)
    const capture = randomUUID()
    const draft = `${org}/transcripts/${capture}/${randomUUID()}/0`
    const committed = `${org}/transcripts/${capture}/${randomUUID()}/0`
    const other = `${org}/transcripts/${randomUUID()}/${randomUUID()}/0`
    await seedCapture(tx, org, user, capture, `${org}/fixture/${capture}`, { status: 'SEGMENTED' })
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
  })
})

it('kolejkuje tylko wygasłe niepowiązane pliki z nagrań ogólnych @REQ: VOICE-RETENTION', async () => {
  await withRollback(async (tx) => {
    const { org, user } = await seedOrganization(tx)
    const resident = randomUUID()
    const capture = randomUUID()
    const path = (key: string) => org + '/app_general/' + user + '/' + key
    const expired = path(randomUUID())
    const current = path(randomUUID())
    const linked = path(capture)
    const unrelated = org + '/fixture/' + randomUUID()
    await tx`INSERT INTO public.residents (id, organization_id, first_name, last_name)
      VALUES (${resident}, ${org}, 'Test', 'Retencja')`
    await seedCapture(tx, org, user, capture, linked)
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
  })
})

it('stosuje retencję placówki i audytuje tylko uprawnione zmiany @REQ: VOICE-RETENTION @REQ: SEC-MFA-STAFF @REQ: ORG-ISOLATION', async () => {
  await withRollback(async (tx) => {
    const short = await seedOrganization(tx)
    const defaultPolicy = await seedOrganization(tx)
    const long = await seedOrganization(tx)

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
    expect(await tx`SELECT private.staff_mfa_disabled_for_tests() AS disabled`).toEqual([{ disabled: false }])
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
    const [fixtureState] = await sql`SELECT EXISTS (SELECT 1 FROM public.voice_captures
      UNION ALL SELECT 1 FROM public.voice_storage_deletions UNION ALL SELECT 1 FROM public.voice_draft_notes
      UNION ALL SELECT 1 FROM private.voice_device_uploads UNION ALL SELECT 1 FROM public.operational_reports
      UNION ALL SELECT 1 FROM public.voice_sanitized_events
      UNION ALL SELECT 1 FROM storage.objects WHERE bucket_id = ${VOICE_RETENTION.storageBucket}) AS has_data`
    expect(fixtureState.has_data).toBe(false)
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
      for (const path of paths) {
        expect((await storage.upload(path, new Uint8Array([1, 2, 3]))).error).toBeNull()
        expect((await storage.download(path)).data).not.toBeNull()
      }
      expect(await sql`SELECT name FROM storage.objects WHERE bucket_id = ${VOICE_RETENTION.storageBucket}
        AND name = ANY(${paths}::text[])`).toHaveLength(paths.length)
      await seedCapture(sql, org, user, expired, expiredAudio, { age: minDays + 1 })
      await seedCapture(sql, org, user, retained, freshAudio)
      await sql`INSERT INTO public.voice_segments
        (organization_id, capture_id, ordinal, start_ms, end_ms, transcript_path)
        VALUES (${org}, ${expired}, 0, 0, 1000, ${expiredTranscript})`
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
      await sql`DELETE FROM public.organizations o WHERE o.id = ${org}
        AND NOT EXISTS (SELECT 1 FROM public.audit_logs a WHERE a.organization_id = o.id)`
    }
  })
