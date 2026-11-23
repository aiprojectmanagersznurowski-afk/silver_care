import { randomUUID } from 'node:crypto'
import { RESIDENT_ASSIGNMENT } from '@silvercare/contracts/src/generated/voice'
import postgres from 'postgres'
import { afterAll, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.pathname !== '/postgres') {
  throw new Error('Voice source correction tests require local Supabase')
}
const sql = postgres(database.toString(), { prepare: false })
const rollback = Symbol('rollback')
type Tx = postgres.TransactionSql
const [shiftOnly, verified] = RESIDENT_ASSIGNMENT.sourceReview.timeModes
const [roster, source] = RESIDENT_ASSIGNMENT.sourceReview.bases
afterAll(() => sql.end())

async function fixture(tx: Tx, reasons = ['TIME_UNCERTAIN']) {
  const org = randomUUID()
  const other = randomUUID()
  const admin = randomUUID()
  const lead = randomUUID()
  const nurse = randomUUID()
  const capture = randomUUID()
  const segment = randomUUID()
  const night = randomUUID()
  const day = randomUUID()
  await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture korekty'), (${other}, 'Fixture obca')`
  await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
    SELECT id, 'authenticated', 'authenticated',
      jsonb_build_object('role', r, 'organization_id', ${org}::uuid)
    FROM unnest(${[admin, lead, nurse]}::uuid[], ARRAY['org_admin','nurse','nurse']) AS u(id, r)`
  await tx`INSERT INTO public.shift_definitions (id, organization_id, code, name, start_time, end_time)
    VALUES (${night}, ${org}, 'fixture-night', 'Nocna', '20:00', '08:00'),
      (${day}, ${org}, 'fixture-day', 'Dzienna', '08:00', '20:00')`
  await tx`INSERT INTO public.shift_roster (organization_id, shift_definition_id, shift_date, user_id, is_shift_lead)
    VALUES (${org}, ${night}, '2026-10-24', ${lead}, true),
      (${org}, ${day}, '2026-10-25', ${nurse}, true)`
  await tx`INSERT INTO public.voice_captures
    (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at, received_at, clock_state, status)
    VALUES (${capture}, ${org}, 'APP_GENERAL', ${capture}, ${org + '/fixture/' + capture}, ${'a'.repeat(64)},
      ${admin}, '2026-11-02T10:00:00Z', '2026-11-02T10:00:00Z', 'UNKNOWN', 'SEGMENTED')`
  await tx`INSERT INTO public.voice_segments
    (id, organization_id, capture_id, ordinal, start_ms, end_ms, transcript_path, author_id, author_attribution)
    VALUES (${segment}, ${org}, ${capture}, 0, 1000, 4000, ${org + '/fixture/' + segment}, ${admin}, 'AUTHENTICATED_SESSION')`
  await tx`INSERT INTO public.voice_assignment_queue (organization_id, segment_id, reasons)
    VALUES (${org}, ${segment}, ${reasons})`
  return { org, other, admin, lead, nurse, segment, capture, night, day }
}

async function asUser(tx: Tx, id: string, role: string, org: string, aal = 'aal2') {
  await tx`SET LOCAL ROLE authenticated`
  await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
    sub: id, role: 'authenticated', aal, session_id: randomUUID(),
    app_metadata: { role, organization_id: org },
  })}, true)`
}

async function transaction(run: (tx: Tx) => Promise<void>) {
  await sql.begin(async (tx) => {
    await run(tx)
    throw rollback
  }).catch((error: unknown) => { if (error !== rollback) throw error })
}

function correct(db: Tx, id: string, version: number, request: string, local: string | null, offset: number | null,
  shift: string | null = null, date: string | null = null) {
  return db`SELECT public.correct_voice_segment_time(${id}, ${version}, ${request}, ${local ? verified : shiftOnly},
    ${local ? source : roster}, ${local}::text::timestamp, ${offset}, ${shift}, ${date}::date) AS result`
}

it('@REQ: VOICE-RESIDENT-ASSIGN przekazuje nocny wyjątek i zapisuje dokładny czas bez nadpisania źródła', async () => {
  await transaction(async (tx) => {
    const { org, other, admin, lead, nurse, segment, capture, night, day } = await fixture(tx)
    for (const [id, role, organization, aal] of [
      [admin, 'org_admin', org, 'aal1'], [admin, 'org_admin', other, 'aal2'],
      [lead, 'nurse', org, 'aal2'], [nurse, 'nurse', org, 'aal2'], [nurse, 'family', org, 'aal2'],
    ]) {
      await asUser(tx, id, role, organization, aal)
      await expect(tx.savepoint((sp) => correct(sp, segment, 0, randomUUID(), null, null, night, '2026-10-24')))
        .rejects.toMatchObject({ code: '42501' })
      expect(await tx`SELECT segment_id FROM public.voice_assignment_queue WHERE segment_id = ${segment}`).toHaveLength(0)
    }
    await asUser(tx, admin, 'org_admin', org)
    const transferKey = randomUUID()
    const first = await correct(tx, segment, 0, transferKey, null, null, night, '2026-10-24')
    expect(first[0].result).toMatchObject({ version: 1, corrected_at: null, shift_date: '2026-10-24' })
    expect(await correct(tx, segment, 0, transferKey, null, null, night, '2026-10-24')).toEqual(first)
    await expect(tx.savepoint((sp) => correct(sp, segment, 0, randomUUID(), null, null, day, '2026-10-25')))
      .rejects.toMatchObject({ code: '40001' })
    await asUser(tx, nurse, 'nurse', org)
    expect(await tx`SELECT segment_id FROM public.voice_assignment_queue WHERE segment_id = ${segment}`).toHaveLength(0)
    await asUser(tx, lead, 'nurse', org)
    expect(await tx`SELECT reasons FROM public.voice_assignment_queue WHERE segment_id = ${segment}`)
      .toEqual([{ reasons: ['TIME_UNCERTAIN'] }])
    await expect(tx.savepoint((sp) => correct(sp, segment, 1, randomUUID(), '2026-10-25 12:00', 60)))
      .rejects.toMatchObject({ code: '42501' })
    const verifyKey = randomUUID()
    const fixed = await correct(tx, segment, 1, verifyKey, '2026-10-25 02:30', 120)
    expect(fixed[0].result).toMatchObject({ version: 2, corrected_at: '2026-10-25T00:30:00+00:00',
      shift_definition_id: night, shift_date: '2026-10-24' })
    expect(await correct(tx, segment, 1, verifyKey, '2026-10-25 02:30', 120)).toEqual(fixed)
    await tx`RESET ROLE`
    const [saved] = await tx`SELECT s.assignment_status, c.clock_state, c.recorded_at, c.received_at
      FROM public.voice_captures c JOIN public.voice_segments s ON s.capture_id = c.id WHERE c.id = ${capture}`
    expect(saved).toEqual({ assignment_status: 'FACILITY', clock_state: 'UNKNOWN',
      recorded_at: new Date('2026-11-02T10:00:00Z'), received_at: new Date('2026-11-02T10:00:00Z') })
    const [audit] = await tx`SELECT count(*)::int AS count FROM public.audit_logs
      WHERE organization_id = ${org} AND action = 'VOICE_SEGMENT_TIME_CORRECTED'`
    expect(audit.count).toBe(2)
  })
})

it('@REQ: VOICE-RESIDENT-ASSIGN rozróżnia czas zimowy, odrzuca lukę i zachowuje inne powody', async () => {
  await transaction(async (tx) => {
    const { org, admin, segment } = await fixture(tx, ['TIME_UNCERTAIN', 'NO_MATCH'])
    await asUser(tx, admin, 'org_admin', org)
    await expect(tx.savepoint((sp) => correct(sp, segment, 0, randomUUID(), '2026-03-29 02:30', 60)))
      .rejects.toMatchObject({ code: '22023' })
    await expect(tx.savepoint((sp) => correct(sp, segment, 0, randomUUID(), '2026-11-03 02:30', 60)))
      .rejects.toMatchObject({ code: '22023' })
    const [fixed] = await correct(tx, segment, 0, randomUUID(), '2026-10-25 02:30', 60)
    expect(fixed.result).toMatchObject({ corrected_at: '2026-10-25T01:30:00+00:00', shift_date: '2026-10-24' })
    expect(await tx`SELECT reasons FROM public.voice_assignment_queue WHERE segment_id = ${segment}`)
      .toEqual([{ reasons: ['NO_MATCH'] }])
  })
})

it('@REQ: NUR-TASKS-VOICE-COMPLETION używa zweryfikowanego początku do dowodu i projekcji', async () => {
  await transaction(async (tx) => {
    const { org, admin, lead, segment, night } = await fixture(tx)
    const task = randomUUID()
    await tx`INSERT INTO public.shift_tasks
      (id, organization_id, shift_definition_id, shift_date, title, source, status, created_by)
      VALUES (${task}, ${org}, ${night}, '2026-10-24', 'Przewietrzyć świetlicę', 'MANUAL', 'TODO', ${admin})`
    await asUser(tx, admin, 'org_admin', org)
    await correct(tx, segment, 0, randomUUID(), '2026-10-25 02:30', 60)
    await tx`SET LOCAL ROLE service_role`
    const [{ claim }] = await tx`SELECT public.claim_voice_segment_projection(${segment}) AS claim`
    const [{ lookup }] = await tx`SELECT public.sync_voice_task_suggestions(${segment}, NULL, ${claim.token}, NULL) AS lookup`
    expect(lookup).toEqual([{ id: task, title: 'Przewietrzyć świetlicę', updated_at: expect.any(String) }])
    const matches = tx.json([{ task_id: task, task_updated_at: lookup[0].updated_at,
      fragment_index: 0, kind: 'COMPLETED', quote: 'Przewietrzyłam świetlicę.' }])
    await tx`SELECT public.sync_voice_task_suggestions(${segment}, NULL, ${claim.token}, ${matches})`
    const facts = tx.json({ behavioral_facts: [], operational_facts: ['Wietrzenie sali wspólnej.'],
      category_codes: [], restricted_medical: [], proposed_tasks: [] })
    await tx`SELECT public.complete_voice_segment_projection(${segment}, ${claim.token}, ${facts})`
    await asUser(tx, lead, 'nurse', org)
    const instant = new Date('2026-10-25T01:30:00Z')
    expect(await tx`SELECT recorded_at FROM public.shift_task_voice_suggestions WHERE task_id = ${task}`)
      .toEqual([{ recorded_at: instant }])
    await tx`RESET ROLE`
    expect(await tx`SELECT recorded_at FROM public.voice_sanitized_events WHERE segment_id = ${segment}`)
      .toEqual([{ recorded_at: instant }])
  })
})
