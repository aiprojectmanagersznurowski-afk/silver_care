import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.username !== 'postgres'
  || database.pathname !== '/postgres') throw new Error('Local database required')
const sql = postgres(database.toString(), { prepare: false })
const rollback = Symbol('rollback')
afterAll(() => sql.end())

it('wiąże rezerwację z urządzeniem, utrwala czas i przyjmuje jedną kopię @REQ: VOICE-DEVICE-INGEST', async () => {
  await sql.begin(async (tx) => {
    const org = randomUUID()
    const otherOrg = randomUUID()
    const device = randomUUID()
    const otherDevice = randomUUID()
    const capture = randomUUID()
    const token = 'a'.repeat(64)
    const otherToken = 'b'.repeat(64)
    const sha256 = 'c'.repeat(64)
    const metadata = tx.json({
      session_id: randomUUID(), session_seq: 2, recorded_at: '2026-01-01T10:00:00Z',
      clock_state: 'RELATIVE', age_ms: 123000, sha256, size_bytes: 123, codec: 'OPUS',
    })
    const reserve = async (hash = token) => (await tx`SELECT
      public.prepare_voice_device_upload(${hash}, ${capture}, ${metadata}) AS result`)[0].result
    const check = async (hash = token) => (await tx`SELECT
      public.prepare_voice_device_upload(${hash}, ${capture}, NULL) AS result`)[0].result
    const commit = async (attempt: string, hash = token) => (await tx`SELECT
      public.commit_voice_device_upload(${hash}, ${capture}, ${attempt}, ${sha256}) AS result`)[0].result

    await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture urządzenia'), (${otherOrg}, 'Inna placówka')`
    await tx`INSERT INTO public.voice_devices (id, organization_id, label, token_hash)
      VALUES (${device}, ${org}, 'Dyktafon testowy', ${token}), (${otherDevice}, ${otherOrg}, 'Inny dyktafon', ${otherToken})`
    expect(await tx`SELECT
      has_function_privilege('authenticated', 'public.prepare_voice_device_upload(text,uuid,jsonb)', 'EXECUTE') AS "canPrepare",
      has_function_privilege('anon', 'public.commit_voice_device_upload(text,uuid,uuid,text)', 'EXECUTE') AS "canCommit"`)
      .toEqual([{ canPrepare: false, canCommit: false }])
    await tx`SET LOCAL ROLE service_role`
    const first = await reserve()
    const retry = await reserve()
    expect(first.status).toBe('PENDING')
    expect(first.path).toBe(`${org}/device/${device}/${capture}/${first.attempt_id}`)
    expect(retry.path).not.toBe(first.path)
    expect(retry.recorded_at).toBe(first.recorded_at)
    expect(await check(otherToken)).toMatchObject({ status: 'HASH_MISMATCH' })
    expect(await commit(retry.attempt_id, otherToken)).toBe('HASH_MISMATCH')

    await tx`RESET ROLE`
    await tx`INSERT INTO storage.objects (bucket_id, name) VALUES ('voice-recordings', ${first.path}), ('voice-recordings', ${retry.path})`
    await tx`SET LOCAL ROLE service_role`
    expect(await commit(retry.attempt_id)).toBe('ACCEPTED')
    expect(await commit(retry.attempt_id)).toBe('DUPLICATE')
    expect(await reserve()).toMatchObject({ status: 'DUPLICATE' })
    await tx`RESET ROLE`
    expect(await tx`SELECT storage_path FROM public.voice_captures WHERE device_id = ${device}`)
      .toEqual([{ storage_path: retry.path }])

    await tx`UPDATE private.voice_device_uploads SET expires_at = statement_timestamp() - interval '1 minute'
      WHERE device_id = ${device}`
    await tx`UPDATE public.voice_devices SET revoked_at = statement_timestamp() WHERE id = ${device}`
    await tx`SET LOCAL ROLE service_role`
    expect(await commit(retry.attempt_id)).toBe('DEVICE_REVOKED')
    await tx`SELECT public.expire_voice_captures()`
    await tx`RESET ROLE`
    expect(await tx`SELECT path FROM public.voice_storage_deletions WHERE path IN (${first.path}, ${retry.path})`)
      .toEqual([{ path: first.path }])
    throw rollback
  }).catch((error: unknown) => { if (error !== rollback) throw error })
})
