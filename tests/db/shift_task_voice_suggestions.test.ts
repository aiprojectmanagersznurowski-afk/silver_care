import { randomUUID } from 'node:crypto'
import { SHIFT_TASK_VOICE } from '@silvercare/contracts/src/generated/roles'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.port !== '54322') {
  throw new Error('Voice task tests require local Supabase')
}
const sql = postgres(database.toString(), { prepare: false })
const undo = Symbol('rollback')
type Tx = postgres.TransactionSql
afterAll(() => sql.end())

async function transaction(test: (tx: Tx) => Promise<void>) {
  await sql.begin(async (tx) => {
    await test(tx)
    throw undo
  }).catch((error: unknown) => {
    if (error !== undo) throw error
  })
}

async function asUser(tx: Tx, user: string, role: string, organization: string, aal = 'aal2') {
  await tx`SET LOCAL ROLE authenticated`
  await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
    sub: user, role: 'authenticated', aal, app_metadata: { role, organization_id: organization },
  })}, true)`
}

const quote = 'Przewietrzyłam świetlicę.'
async function fixture(tx: Tx) {
  const org = randomUUID()
  const other = randomUUID()
  const author = randomUUID()
  const lead = randomUUID()
  const admin = randomUUID()
  const capture = randomUUID()
  const shift = randomUUID()
  const otherShift = randomUUID()
  const segment = randomUUID()
  const task = randomUUID()
  const sourceKey = randomUUID()
  const [{ shift_date: date, recorded_at: recordedAt }] = await tx`
    SELECT (CURRENT_DATE - 2)::text AS shift_date,
      (CURRENT_DATE - 1 + TIME '02:05') AT TIME ZONE 'Europe/Warsaw' AS recorded_at`
  await tx`INSERT INTO public.organizations (id, name)
    VALUES (${org}, 'Fixture zadania głosowe'), (${other}, 'Fixture zadania głosowe B')`
  await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
    SELECT id, 'authenticated', 'authenticated',
      jsonb_build_object('role', CASE WHEN id = ${admin}::uuid THEN 'org_admin' ELSE 'nurse' END,
        'organization_id', ${org}::uuid)
    FROM unnest(${[author, lead, admin]}::uuid[]) AS u(id)`
  await tx`INSERT INTO public.shift_definitions (id, organization_id, code, name, start_time, end_time)
    VALUES (${shift}, ${org}, 'night', 'Nocna', '19:00', '07:00'),
      (${otherShift}, ${org}, 'day', 'Dzienna', '07:00', '19:00')`
  await tx`INSERT INTO public.shift_roster (organization_id, shift_definition_id, shift_date, user_id, is_shift_lead)
    VALUES (${org}, ${shift}, ${date}, ${lead}, true),
      (${org}, ${otherShift}, ${date}, ${author}, true)`
  await tx`INSERT INTO public.voice_captures
    (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at, status)
    VALUES (${capture}, ${org}, 'APP_GENERAL', ${sourceKey}, ${org + '/app_general/' + sourceKey},
      ${'a'.repeat(64)}, ${author}, ${recordedAt}, 'SEGMENTED')`
  await tx`INSERT INTO public.voice_segments
    (id, organization_id, capture_id, ordinal, start_ms, end_ms, assignment_status, author_id, author_attribution)
    VALUES (${segment}, ${org}, ${capture}, 0, 0, 1000, 'FACILITY', ${author}, 'AUTHENTICATED_SESSION')`
  await tx`INSERT INTO public.shift_tasks
    (id, organization_id, shift_definition_id, shift_date, title, source, status, created_by)
    VALUES (${task}, ${org}, ${shift}, ${date}, 'Przewietrzyć świetlicę', 'MANUAL', 'TODO', ${admin})`
  const [{ id: evidence }] = await tx`
    INSERT INTO public.shift_task_voice_suggestions (organization_id, shift_definition_id, shift_date, task_id,
      segment_id, source_id, fragment_index, source_kind, author_id, author_attribution, recorded_at,
      received_at, task_updated_at, kind, quote)
    SELECT t.organization_id, t.shift_definition_id, t.shift_date, t.id, ${segment}, ${segment}, 0,
      c.source, c.author_id, 'AUTHENTICATED_SESSION', c.recorded_at, c.received_at, t.updated_at,
      'COMPLETED', ${quote}
    FROM public.shift_tasks t CROSS JOIN public.voice_captures c WHERE t.id = ${task} AND c.id = ${capture}
    RETURNING id`
  return { org, other, author, lead, admin, capture, task, evidence }
}

function decide(tx: Tx, evidence: string) {
  return tx`SELECT public.decide_shift_task_voice_suggestion(${evidence}, 'DONE', NULL, NULL, NULL) AS task_id`
}

describe('Dowód głosowy rozliczenia zmiany', () => {
  it('@REQ: NUR-TASKS-VOICE-COMPLETION odmawia odczytu i decyzji bez aal2, poza zmianą lub placówką', async () => {
    await transaction(async (tx) => {
      const { org, other, author, lead, admin, evidence } = await fixture(tx)
      for (const [user, role, tenant, aal] of [
        [lead, 'nurse', org, 'aal1'],
        [admin, 'org_admin', org, 'aal1'],
        [author, 'nurse', org, 'aal2'],
        [admin, 'org_admin', other, 'aal2'],
        [author, 'family', org, 'aal2'],
      ]) {
        await asUser(tx, user, role, tenant, aal)
        expect(await tx`SELECT quote FROM public.shift_task_voice_suggestions WHERE id = ${evidence}`).toEqual([])
        await expect(tx.savepoint((sp) => decide(sp, evidence))).rejects.toMatchObject({ code: '42501' })
      }
      await asUser(tx, admin, 'org_admin', org)
      expect(await tx`SELECT quote FROM public.shift_task_voice_suggestions WHERE id = ${evidence}`)
        .toEqual([{ quote }])
    })
  })

  it('@REQ: NUR-TASKS-VOICE-COMPLETION rozlicza raz przez kierownika nocnej zmiany i usuwa cytat ze źródłem', async () => {
    await transaction(async (tx) => {
      const { org, lead, capture, task, evidence } = await fixture(tx)
      await asUser(tx, lead, 'nurse', org)
      expect(await decide(tx, evidence)).toEqual([{ task_id: task }])
      expect(await decide(tx, evidence)).toEqual([{ task_id: task }])
      await tx`RESET ROLE`
      const [settled] = await tx`SELECT status, settled_by, settled_at FROM public.shift_tasks WHERE id = ${task}`
      expect(settled).toMatchObject({ status: 'DONE', settled_by: lead, settled_at: expect.any(Date) })
      const audit = async () => tx`SELECT performed_by, payload FROM public.audit_logs
        WHERE organization_id = ${org} AND action = ${SHIFT_TASK_VOICE.auditAction}`
      expect(await audit()).toEqual([{
        performed_by: lead, payload: expect.objectContaining({ task_id: task, evidence_id: evidence, decision: 'DONE' }),
      }])
      expect(JSON.stringify(await audit())).not.toContain(quote)
      await tx`DELETE FROM public.voice_captures WHERE id = ${capture}`
      expect(await tx`SELECT id FROM public.shift_task_voice_suggestions WHERE id = ${evidence}`).toEqual([])
      expect(await audit()).toHaveLength(1)
    })
  })
})
