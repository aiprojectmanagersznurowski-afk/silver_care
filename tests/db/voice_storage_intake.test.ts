import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.port !== '54322'
  || database.username !== 'postgres' || database.pathname !== '/postgres') throw new Error('Local database required')
const sql = postgres(database.toString(), { prepare: false })
const rollback = Symbol('rollback')
afterAll(() => sql.end())

it('przyjmuje poświadczenie pliku tylko dla urządzenia placówki i deduplikuje retry @REQ: VOICE-DEVICE-INGEST', async () => {
  await sql.begin(async (tx) => {
    const org = randomUUID()
    const anotherOrg = randomUUID()
    const device = randomUUID()
    const session = randomUUID()
    const key = randomUUID()
    const sha256 = 'a'.repeat(64)
    const path = `${org}/device/${device}/${key}`
    await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture urządzenia'), (${anotherOrg}, 'Inna placówka')`
    await tx`INSERT INTO public.voice_devices (id, organization_id, label, token_hash)
      VALUES (${device}, ${org}, 'Dyktafon testowy', ${device.replaceAll('-', '').repeat(2)})`
    await tx`INSERT INTO storage.objects (bucket_id, name) VALUES ('voice-recordings', ${path})`
    await tx`SET LOCAL ROLE authenticated`
    await expect(tx.savepoint((sp) => sp`SELECT public.register_stored_device_capture(
      ${device}, ${key}, ${session}, 1, ${path}, ${sha256}, now(), 'SYNCED')`))
      .rejects.toMatchObject({ code: '42501' })
    await tx`SET LOCAL ROLE service_role`
    const [first] = await tx`SELECT public.register_stored_device_capture(
      ${device}, ${key}, ${session}, 1, ${path}, ${sha256}, now(), 'SYNCED') AS id`
    const [retry] = await tx`SELECT public.register_stored_device_capture(
      ${device}, ${key}, ${session}, 1, ${path}, ${sha256}, now(), 'SYNCED') AS id`
    expect(retry.id).toBe(first.id)
    await expect(tx.savepoint((sp) => sp`SELECT public.register_stored_device_capture(
      ${device}, ${key}, ${session}, 1, ${anotherOrg + '/device/' + device + '/' + key}, ${sha256}, now(), 'SYNCED')`))
      .rejects.toMatchObject({ message: 'INVALID_VOICE_STORAGE_PATH' })
    throw rollback
  }).catch((error: unknown) => { if (error !== rollback) throw error })
})
