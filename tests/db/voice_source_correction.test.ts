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
      ${admin}, '2026-11-02T10:00:00Z', now(), 'UNKNOWN', 'SEGMENTED')`
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
      recorded_at: new Date('2026-11-02T10:00:00Z'), received_at: expect.any(Date) })
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
    await expect(tx.savepoint((sp) => correct(sp, segment, 0, randomUUID(), '2099-11-03 02:30', 60)))
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

it('@REQ: VOICE-RESIDENT-ASSIGN dzieli tylko dostępne audio, zachowuje wersję i niezależnie wznawia dzieci', async () => {
  await transaction(async (tx) => {
    const { org, admin, lead, segment, capture, night } = await fixture(tx, ['TIME_UNCERTAIN', 'MIXED_SEGMENT'])
    const residentA = randomUUID()
    const residentB = randomUUID()
    await tx`INSERT INTO public.residents (id, organization_id, first_name, last_name)
      VALUES (${residentA}, ${org}, 'Anna', 'Testowa'), (${residentB}, ${org}, 'Ewa', 'Próbna')`
    await asUser(tx, admin, 'org_admin', org)
    await correct(tx, segment, 0, randomUUID(), '2026-10-25 02:30', 60)
    const parts = [{ start_ms: 1000, end_ms: 1900 }, { start_ms: 1900, end_ms: 2800 },
      { start_ms: 2800, end_ms: 3700 }, { start_ms: 3700, end_ms: 4000, excluded: true }]
    const split = (db: Tx, input: typeof parts, key = randomUUID()) =>
      db`SELECT public.split_voice_segment(${segment}, 1, ${key}, ${db.json(input)}) AS split`
    await expect(tx.savepoint((sp) => split(sp, parts))).rejects.toMatchObject({ message: 'VOICE_AUDIO_UNAVAILABLE' })
    await tx`RESET ROLE`
    await tx`INSERT INTO storage.objects (bucket_id, name) VALUES ('voice-recordings', ${org + '/fixture/' + capture})`
    await asUser(tx, lead, 'nurse', org)
    await expect(tx.savepoint((sp) => split(sp, [{ start_ms: 999, end_ms: 2000 }, parts[1]])))
      .rejects.toMatchObject({ code: '22023' })
    await expect(tx.savepoint((sp) => split(sp, [parts[0], { start_ms: 1800, end_ms: 2800 }])))
      .rejects.toMatchObject({ code: '22023' })
    const key = randomUUID()
    const saved = await split(tx, parts, key)
    expect(await split(tx, parts, key)).toEqual(saved)
    await expect(tx.savepoint((sp) => split(sp, parts))).rejects.toMatchObject({ code: '40001' })
    const kids = saved[0].split.children as { segment_id: string; start_ms: number; end_ms: number }[]
    expect(kids.map(({ start_ms, end_ms }) => [start_ms, end_ms])).toEqual([[1000, 1900], [1900, 2800], [2800, 3700], [3700, 4000]])
    await tx`SET LOCAL ROLE service_role`
    expect(await tx`SELECT public.claim_voice_segment_projection(${segment}) AS claim`).toEqual([{ claim: null }])
    const [notExcluded] = await tx`SELECT public.claim_voice_segment_transcription(${kids[3].segment_id}) AS claim`
    expect(notExcluded.claim).toBeNull()
    for (const [index, resident] of [residentA, residentB, null].entries()) {
      const { segment_id } = kids[index]
      const [{ claim }] = await tx`SELECT public.claim_voice_segment_transcription(${segment_id}) AS claim`
      const path = `${org}/transcripts/${capture}/${segment_id}/${claim.token}`
      const payload = tx.json({ transcript_path: path, scope: resident ? 'RESIDENT' : 'FACILITY',
        resident_id: resident, reasons: index === 1 ? ['MIXED_SEGMENT'] : [], candidate_ids: [] })
      // A stale worker cannot complete a lease owned by a different invocation.
      expect(await tx`SELECT public.finish_voice_segment_transcription(${segment_id}, ${randomUUID()}, ${payload}) AS ok`)
        .toEqual([{ ok: false }])
      expect(await tx`SELECT public.finish_voice_segment_transcription(${segment_id}, ${claim.token}, ${payload}) AS ok`)
        .toEqual([{ ok: true }])
    }
    const [ready] = await tx`SELECT public.claim_voice_segment_projection(${kids[0].segment_id}) AS claim`
    expect(ready.claim).toMatchObject({ resident_id: residentA, scope: 'resident' })
    expect(await tx`SELECT public.claim_voice_segment_projection(${kids[1].segment_id}) AS claim`).toEqual([{ claim: null }])
    const [facility] = await tx`SELECT public.claim_voice_segment_projection(${kids[2].segment_id}) AS claim`
    expect(facility.claim).toMatchObject({ scope: 'facility' })
    await tx`RESET ROLE`
    const [open] = await tx`SELECT shift_definition_id, shift_date::text, reasons FROM public.voice_assignment_queue
      WHERE segment_id = ${kids[1].segment_id} AND decided_at IS NULL`
    expect(open).toEqual({ shift_definition_id: night, shift_date: '2026-10-24', reasons: ['MIXED_SEGMENT'] })
    const [parent] = await tx`SELECT assignment_status FROM public.voice_segments WHERE id = ${segment}`
    expect(parent.assignment_status).toBe('SPLIT')
    const childIds = kids.map(({ segment_id }) => segment_id)
    expect(await tx`SELECT DISTINCT capture_id, parent_segment_id FROM public.voice_segments WHERE id IN ${tx(childIds)}`)
      .toEqual([{ capture_id: capture, parent_segment_id: segment }])
    await tx`UPDATE public.voice_captures SET received_at = now() - interval '100 days' WHERE id = ${capture}`
    await tx`SET LOCAL ROLE service_role`
    await tx`SELECT public.expire_voice_captures()`
    expect(await tx`SELECT id FROM public.voice_segments WHERE capture_id = ${capture}`).toHaveLength(0)
    expect(await tx`SELECT path FROM public.voice_storage_deletions WHERE path LIKE ${org + '/transcripts/' + capture + '/%'}`)
      .toHaveLength(3)
  })
})

it('@REQ: VOICE-RESIDENT-ASSIGN odbiera dostęp do odsłuchu po decyzji i odrzuca nieaktualny zakres', async () => {
  await transaction(async (tx) => {
    const { org, admin, lead, nurse, segment, capture } = await fixture(tx, ['TIME_UNCERTAIN', 'NO_MATCH'])
    await tx`INSERT INTO storage.objects (bucket_id, name) VALUES ('voice-recordings', ${org + '/fixture/' + capture})`
    const visible = async () => (await tx`SELECT public.can_play_voice_segment(${segment}) AS allowed`)[0].allowed
    await asUser(tx, lead, 'nurse', org)
    expect(await visible()).toBe(false)
    await asUser(tx, admin, 'org_admin', org)
    await correct(tx, segment, 0, randomUUID(), '2026-10-25 02:30', 120)
    await asUser(tx, nurse, 'nurse', org)
    expect(await visible()).toBe(false)
    await asUser(tx, lead, 'nurse', org)
    expect(await visible()).toBe(true)
    const key = randomUUID()
    const scope = (db: Tx, version: number) =>
      db`SELECT public.review_voice_segment_scope(${segment}, ${version}, ${key}, 'FACILITY') AS result`
    await expect(tx.savepoint((sp) => scope(sp, 0))).rejects.toMatchObject({ code: '40001' })
    const saved = await scope(tx, 1)
    expect(saved[0].result).toMatchObject({ version: 2, closed: true })
    expect(await scope(tx, 1)).toEqual(saved)
    expect(await visible()).toBe(false)
  })
})
