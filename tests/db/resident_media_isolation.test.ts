import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.pathname !== '/postgres') {
  throw new Error('Tests require local Supabase')
}
const sql = postgres(database.toString(), { prepare: false })
const rollback = Symbol('rollback')
afterAll(() => sql.end())

it('ogranicza odczyt zdjęć i umów według placówki i roli @REQ: ORG-ISOLATION', async () => {
  await sql.begin(async (tx) => {
    const org = randomUUID()
    const otherOrg = randomUUID()
    const resident = randomUUID()
    const otherResident = randomUUID()
    const user = randomUUID()
    const samePhoto = resident + '/photo.webp'
    const foreignPhoto = otherResident + '/photo.webp'
    const document = 'contracts/' + resident + '/document.pdf'
    await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture A'), (${otherOrg}, 'Fixture B')`
    await tx`INSERT INTO auth.users (id) VALUES (${user})`
    await tx`INSERT INTO public.residents (id, organization_id, first_name, last_name, contract_document_path)
      VALUES (${resident}, ${org}, 'Test', 'A', ${document}), (${otherResident}, ${otherOrg}, 'Test', 'B', NULL)`
    await tx`INSERT INTO public.resident_media (resident_id, storage_path, content_type, uploaded_by)
      VALUES (${resident}, ${samePhoto}, 'image/webp', ${user}),
      (${otherResident}, ${foreignPhoto}, 'image/webp', ${user}),
      (${resident}, ${document}, 'application/pdf', ${user})`
    await tx`INSERT INTO public.resident_relative_links (resident_id, relative_user_id, relationship_code, role)
      VALUES (${resident}, ${user}, 'SON', 'family')`
    await tx`INSERT INTO storage.objects (bucket_id, name) VALUES
      ('resident-media', ${samePhoto}), ('resident-media', ${foreignPhoto}), ('resident-media', ${document})`
    await tx`SET LOCAL ROLE authenticated`
    for (const [role, expected] of [['org_admin', [samePhoto, document]], ['nurse', [samePhoto]], ['family', [samePhoto]]] as const) {
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
        sub: user, aal: 'aal2', role: 'authenticated', app_metadata: { role, organization_id: org },
      })}, true)`
      const visible = await tx`SELECT name FROM storage.objects WHERE bucket_id = 'resident-media'
        AND name IN (${samePhoto}, ${foreignPhoto}, ${document})`
      expect(visible.map(({ name }) => name).sort(), role).toEqual([...expected].sort())
      if (role === 'family') {
        expect(await tx`SELECT id FROM public.resident_media WHERE storage_path = ${document}`).toHaveLength(0)
      }
    }
    throw rollback
  }).catch((error: unknown) => { if (error !== rollback) throw error })
})
