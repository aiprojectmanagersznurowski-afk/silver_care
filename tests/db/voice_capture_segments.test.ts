import { randomUUID } from 'node:crypto'
import { RESIDENT_ASSIGNMENT } from '@silvercare/contracts/src/generated/voice'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (!['127.0.0.1', 'localhost'].includes(database.hostname)
  || database.username !== 'postgres' || database.pathname !== '/postgres') {
  throw new Error('Voice capture tests require the local Supabase test database')
}
const sql = postgres(database.toString(), { prepare: false })
const rollback = Symbol('rollback')
type Tx = postgres.TransactionSql

afterAll(() => sql.end())

async function transaction(test: (tx: Tx) => Promise<void>) {
  await sql.begin(async (tx) => {
    await test(tx)
    throw rollback
  }).catch((error: unknown) => {
    if (error !== rollback) throw error
  })
}

async function asUser(tx: Tx, user: string, role: string, organization: string) {
  await tx`SET LOCAL ROLE authenticated`
  await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
    sub: user, role: 'authenticated', aal: 'aal2', session_id: randomUUID(),
    app_metadata: { role, organization_id: organization },
  })}, true)`
}

async function fixture(tx: Tx) {
  const org = randomUUID()
  const other = randomUUID()
  const author = randomUUID()
  const lead = randomUUID()
  const capture = randomUUID()
  const shift = randomUUID()
  const date = '2026-11-22'
  const sourceKey = randomUUID()
  await tx`INSERT INTO public.organizations (id, name)
    VALUES (${org}, 'Fixture głos'), (${other}, 'Fixture głos B')`
  await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
    SELECT id, 'authenticated', 'authenticated',
      jsonb_build_object('role', 'nurse', 'organization_id', ${org}::uuid)
    FROM unnest(${[author, lead]}::uuid[]) AS u(id)`
  await tx`INSERT INTO public.shift_definitions (id, organization_id, code, name, start_time, end_time)
    VALUES (${shift}, ${org}, 'test', 'Test', '08:00', '20:00')`
  await tx`INSERT INTO public.shift_roster (organization_id, shift_definition_id, shift_date, user_id, is_shift_lead)
    VALUES (${org}, ${shift}, ${date}, ${lead}, true)`
  await tx`INSERT INTO public.voice_captures
    (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at)
    VALUES (${capture}, ${org}, 'APP_GENERAL', ${sourceKey}, ${org + '/app_general/' + sourceKey},
      ${'a'.repeat(64)}, ${author}, now())`
  return { org, other, author, lead, capture, shift, date, sourceKey }
}

describe('Nagrania i fragmenty', () => {
  it('wyznacza dyżur z czasu każdego fragmentu i zachowuje datę rozpoczęcia nocy @REQ: VOICE-RESIDENT-ASSIGN', async () => {
    await transaction(async (tx) => {
      const { org, author, lead, capture, shift: day } = await fixture(tx)
      const night = randomUUID()
      const afterMidnight = randomUUID()
      await tx`UPDATE public.shift_definitions SET is_active = (id = ${day})
        WHERE organization_id = ${org}`
      await tx`UPDATE public.shift_definitions SET start_time = '07:00', end_time = '19:00' WHERE id = ${day}`
      await tx`INSERT INTO public.shift_definitions (id, organization_id, code, name, start_time, end_time)
        VALUES (${night}, ${org}, 'fixture-night', 'Nocna', '19:00', '07:00')`
      await tx`UPDATE public.shift_roster SET shift_definition_id = ${night}
        WHERE organization_id = ${org} AND user_id = ${lead}`
      await tx`UPDATE public.voice_captures SET recorded_at = '2026-11-22 18:59+01' WHERE id = ${capture}`
      await tx`INSERT INTO public.voice_captures
        (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at)
        VALUES (${afterMidnight}, ${org}, 'APP_GENERAL', ${afterMidnight}, ${org + '/fixture/' + afterMidnight},
          ${'a'.repeat(64)}, ${author}, '2026-11-23 00:00+01')`

      await tx`SET LOCAL ROLE service_role`
      for (const [id, offsets] of [[capture, [0, 120_000]], [afterMidnight, [60_000]]] as const) {
        const [claim] = await tx`SELECT processing_token FROM public.claim_voice_capture(${id})`
        const segments = offsets.map((start, ordinal) => ({
          ordinal, start_ms: start, end_ms: start + 1_000,
          transcript_path: `${org}/transcripts/${id}/${claim.processing_token}/${ordinal}`,
          scope: 'PENDING', reasons: ['NO_MATCH'],
        }))
        await tx`SELECT public.finalize_voice_capture(${id}, ${claim.processing_token}, ${tx.json(segments)})`
      }

      await tx`RESET ROLE`
      const rows = await tx`SELECT q.shift_definition_id AS shift, q.shift_date::text AS date,
        s.derived_start_at AS start, s.corrected_at, private.voice_segment_effective_at(s, c) AS effective
        FROM public.voice_assignment_queue q JOIN public.voice_segments s ON s.id = q.segment_id
        JOIN public.voice_captures c ON c.id = s.capture_id
        WHERE q.organization_id = ${org} ORDER BY c.recorded_at, s.ordinal`
      expect(rows).toEqual([
        [day, '2026-11-22T17:59Z'], [night, '2026-11-22T18:01Z'], [night, '2026-11-22T23:01Z'],
      ].map(([shift, time]) => ({
        shift, date: '2026-11-22', start: new Date(time), corrected_at: null, effective: new Date(time),
      })))

      await asUser(tx, lead, 'nurse', org)
      expect(await tx`SELECT shift_definition_id FROM public.voice_assignment_queue WHERE organization_id = ${org}`)
        .toEqual([{ shift_definition_id: night }, { shift_definition_id: night }])
    })
  })

  it('chroni dane źródłowe i utrzymuje odrębne fragmenty po jednym nagraniu @REQ: VOICE-RESIDENT-ASSIGN', async () => {
    await transaction(async (tx) => {
      const fixtureIds = await fixture(tx)
      const { org, other, author, capture, sourceKey } = fixtureIds
      const [storage] = await tx`SELECT public FROM storage.buckets WHERE id = 'voice-recordings'`
      expect(storage?.public).toBe(false)
      const [first, second] = await tx`INSERT INTO public.voice_segments
        (organization_id, capture_id, ordinal, start_ms, end_ms)
        VALUES (${org}, ${capture}, 0, 0, 1350),
          (${org}, ${capture}, 1, 1500, 2300)
        RETURNING id, assignment_status`
      expect(first?.assignment_status).toBe('PENDING')
      expect(first?.id).not.toBe(second?.id)
      await expect(tx.savepoint((sp) => sp`INSERT INTO public.voice_segments
        (organization_id, capture_id, ordinal, start_ms, end_ms)
        VALUES (${other}, ${capture}, 2, 0, 1200)`))
        .rejects.toMatchObject({ code: '23503' })
      await expect(tx.savepoint((sp) => sp`INSERT INTO public.voice_segments
        (organization_id, capture_id, ordinal, start_ms, end_ms)
        VALUES (${org}, ${capture}, 1, 2500, 3500)`))
        .rejects.toMatchObject({ code: '23505' })
      await expect(tx.savepoint((sp) => sp`INSERT INTO public.voice_captures
        (organization_id, source, source_key, storage_path, sha256, author_id, recorded_at)
        VALUES (${org}, 'APP_GENERAL', ${sourceKey}, ${org + '/app_general/' + randomUUID()},
          ${'b'.repeat(64)}, ${author}, now())`))
        .rejects.toMatchObject({ code: '23505' })
      for (const resource of [RESIDENT_ASSIGNMENT.captureResource, RESIDENT_ASSIGNMENT.segmentResource]) {
        const [access] = await tx`SELECT relrowsecurity,
          has_table_privilege('authenticated', oid, 'SELECT') AS signed_in,
          has_table_privilege('anon', oid, 'SELECT') AS guest
          FROM pg_class WHERE oid = ${'public.' + resource}::regclass`
        expect(access).toMatchObject({ relrowsecurity: true, signed_in: false, guest: false })
      }
    })
  })

  it('pokazuje wyjątek tylko kierownikowi tej zmiany albo kierownikowi placówki @REQ: VOICE-RESIDENT-ASSIGN', async () => {
    await transaction(async (tx) => {
      const { org, other, author, lead, capture, shift, date } = await fixture(tx)
      const [segment] = await tx`INSERT INTO public.voice_segments
        (organization_id, capture_id, ordinal, start_ms, end_ms)
        VALUES (${org}, ${capture}, 0, 0, 2000)
        RETURNING id`
      await tx`INSERT INTO public.voice_assignment_queue
        (organization_id, segment_id, shift_definition_id, shift_date, reasons)
        VALUES (${org}, ${segment.id}, ${shift}, ${date}, ARRAY['NO_MATCH'])`
      const visible = () => tx`SELECT segment_id FROM public.voice_assignment_queue WHERE segment_id = ${segment.id}`
      for (const [user, role, tenant, count] of [
        [author, 'family', org, 0], [author, 'legal_guardian', org, 0],
        [author, 'nurse', org, 0], [lead, 'nurse', org, 1],
        [lead, 'org_admin', other, 0], [lead, 'org_admin', org, 1],
      ] as const) {
        await asUser(tx, user, role, tenant)
        expect(await visible()).toHaveLength(count)
      }
      await expect(tx.savepoint((sp) => sp`UPDATE public.voice_assignment_queue
        SET decided_at = now() WHERE segment_id = ${segment.id}`))
        .rejects.toMatchObject({ code: '42501' })
    })
  })
})
