import { afterAll, expect, it } from 'vitest'
import postgres from 'postgres'

// @REQ: NUR-SHIFT-CLOSURE
const db = postgres(process.env.DATABASE_URL!, { prepare: false })
const date = '2026-11-18'
const insideShift = '2026-11-18T10:00:00+01:00'

afterAll(() => db.end())

async function fixture(tx: postgres.TransactionSql) {
  const [org] = await tx`INSERT INTO public.organizations (name) VALUES ('Test przekazania') RETURNING id`
  const [foreign] = await tx`INSERT INTO public.organizations (name) VALUES ('Test obcej placówki') RETURNING id`
  const user = async (role: string, organizationId = org.id) => {
    const [row] = await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
      VALUES (gen_random_uuid(), 'authenticated', 'authenticated',
        ${tx.json({ role, organization_id: organizationId })}) RETURNING id`
    return row.id as string
  }
  const admin = await user('org_admin')
  const lead = await user('nurse')
  const staff = await user('nurse')
  const family = await user('family')
  const otherAdmin = await user('org_admin', foreign.id)
  const [shift] = await tx`INSERT INTO public.shift_definitions
    (organization_id, code, name, start_time, end_time) VALUES
    (${org.id}, 'DAY', 'Dzienna', '07:00', '19:00') RETURNING id`
  const [next] = await tx`INSERT INTO public.shift_definitions
    (organization_id, code, name, start_time, end_time) VALUES
    (${org.id}, 'NIGHT', 'Nocna', '19:00', '07:00') RETURNING id`
  await tx`INSERT INTO public.shift_roster (organization_id, shift_definition_id, shift_date, user_id, is_shift_lead)
    VALUES (${org.id}, ${shift.id}, ${date}, ${lead}, true), (${org.id}, ${next.id}, ${date}, ${staff}, false)`
  const claims = async (actor: string, role = 'nurse', organizationId = org.id, aal = 'aal2') => {
    await tx`SET LOCAL ROLE authenticated`
    await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
      sub: actor, role: 'authenticated', app_metadata: { role, organization_id: organizationId }, aal,
    })}, true)`
  }
  const amendFact = async () => {
    await tx`RESET ROLE`
    const [row] = await tx`INSERT INTO public.voice_sanitized_events
      (organization_id, capture_source, scope, author_id, sanitized_text, matched_categories, recorded_at, metadata)
      VALUES (${org.id}, 'APP_GENERAL', 'facility', ${lead}, 'Testowy fakt', '{}', ${insideShift}, '{"pipeline_stage":"REDACT"}')
      RETURNING id`
    await claims(lead)
    return row.id as string
  }
  const preview = async () => {
    const [row] = await tx`SELECT public.preview_shift_handover(${shift.id}, ${date}::date) AS result`
    return row.result
  }
  const approve = async (revision: string, completeness = 'UNKNOWN', reason: string | null = 'Trwa synchronizacja', expected: string[] = []) => {
    const [row] = await tx`SELECT public.approve_shift_handover(
      ${shift.id}, ${date}::date, ${revision}, ${completeness}, ${reason}, ${expected}::uuid[]) AS version`
    return row.version
  }
  const deny = async (expected: RegExp, call: () => Promise<unknown>) => {
    await expect(tx.savepoint(() => call())).rejects.toThrow(expected)
  }
  return { org: org.id, foreign: foreign.id, shift: shift.id, next: next.id, admin, lead, staff, family, otherAdmin,
    claims, amendFact, preview, approve, deny }
}

async function rollback(run: (tx: postgres.TransactionSql) => Promise<void>) {
  await db.begin(async (tx) => {
    await run(tx)
    throw new Error('ROLLBACK_FIXTURE')
  }).catch((error: Error) => { if (error.message !== 'ROLLBACK_FIXTURE') throw error })
}

it('@REQ: NUR-SHIFT-CLOSURE approves once, carries open tasks and links a late fact to the prior version', async () => {
  await rollback(async (tx) => {
    const s = await fixture(tx)
    await s.claims(s.lead)
    const [task] = await tx`INSERT INTO public.shift_tasks
      (organization_id, shift_definition_id, shift_date, title, created_by, status)
      VALUES (${s.org}, ${s.shift}, ${date}, 'Zadanie testowe', ${s.lead}, 'TODO') RETURNING id`
    const draft = await s.preview()
    await s.deny(/SHIFT_HANDOVER_REASON_REQUIRED/, () => s.approve(draft.revision, 'PARTIAL', ' '))
    await s.deny(/SHIFT_HANDOVER_EVIDENCE_REQUIRED/, () => s.approve(draft.revision, 'COMPLETE', null))
    expect(await s.approve(draft.revision)).toBe(1)
    await s.deny(/SHIFT_HANDOVER_STALE/, () => s.approve(draft.revision))
    await s.claims(s.admin, 'org_admin')
    const [copy] = await tx`SELECT id FROM public.shift_tasks
      WHERE shift_definition_id = ${s.next} AND shift_date = ${date} AND carried_from_task_id = ${task.id}`
    expect(copy?.id).toBeTruthy()
    await s.claims(s.lead)
    expect(await s.preview()).toMatchObject({ versions: [{ version: 1, previousVersion: null }], facts: [], canApprove: false })

    const lateId = await s.amendFact()
    const amendment = await s.preview()
    expect(amendment).toMatchObject({ latestVersion: 1, canApprove: true, facts: [{ id: lateId }] })
    await s.deny(/SHIFT_HANDOVER_EVIDENCE_REQUIRED/, () => s.approve(amendment.revision, 'COMPLETE', null, [crypto.randomUUID()]))
    expect(await s.approve(amendment.revision)).toBe(2)
    expect(await s.preview()).toMatchObject({
      facts: [], canApprove: false,
      versions: [{ version: 2, previousVersion: 1, facts: [{ id: lateId }] }, { version: 1, previousVersion: null, facts: [] }],
    })

    await s.claims(s.admin, 'org_admin')
    const events = await tx`SELECT action, performed_by, payload FROM public.audit_logs
      WHERE organization_id = ${s.org} AND action LIKE 'SHIFT_HANDOVER_%' ORDER BY id`
    expect(events).toHaveLength(2)
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'SHIFT_HANDOVER_APPROVED', performed_by: s.lead, payload: expect.objectContaining({ version: 1 }) }),
      expect.objectContaining({ action: 'SHIFT_HANDOVER_AMENDMENT_APPROVED', performed_by: s.lead, payload: expect.objectContaining({ version: 2, previous_version: 1 }) }),
    ]))
    expect(JSON.stringify(events)).not.toContain('Testowy fakt')
  })
})

it('@REQ: NUR-SHIFT-CLOSURE enforces tenant, roster, staff role and MFA for preview and history', async () => {
  await rollback(async (tx) => {
    const s = await fixture(tx)
    await s.claims(s.staff)
    await s.deny(/SHIFT_HANDOVER_FORBIDDEN/, s.preview)
    await s.claims(s.family, 'family')
    await s.deny(/SHIFT_HANDOVER_FORBIDDEN/, s.preview)
    await s.claims(s.otherAdmin, 'org_admin', s.foreign)
    await s.deny(/SHIFT_HANDOVER_FORBIDDEN/, s.preview)
    await s.claims(s.admin, 'org_admin', s.org, 'aal1')
    await s.deny(/SHIFT_HANDOVER_FORBIDDEN/, s.preview)
    await s.claims(s.admin, 'org_admin')
    expect(await s.preview()).toMatchObject({ canApprove: true, facts: [], versions: [] })
  })
})

it('@REQ: NUR-SHIFT-CLOSURE scopes the task list to roster membership and exposes only the manager’s audit history', async () => {
  await rollback(async (tx) => {
    const s = await fixture(tx)
    await s.claims(s.lead)
    const [task] = await tx`INSERT INTO public.shift_tasks
      (organization_id, shift_definition_id, shift_date, title, created_by, status)
      VALUES (${s.org}, ${s.shift}, ${date}, 'Treść przykładowego zadania', ${s.lead}, 'TODO') RETURNING id`
    await s.claims(s.lead, 'nurse', s.org, 'aal1')
    await s.deny(/SHIFT_TASK_FORBIDDEN/, () => tx`SELECT public.settle_shift_task(${task.id}, 'DONE', NULL, NULL, NULL)`)
    await s.claims(s.lead)
    await tx`SELECT public.settle_shift_task(${task.id}, 'DONE', NULL, NULL, NULL)`
    const [history] = await tx`SELECT public.read_shift_handover_audit(${s.shift}, ${date}::date, 0) AS events`
    expect(history.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'SHIFT_TASK_CREATED', actor: s.lead, taskId: task.id, at: expect.any(String) }),
      expect.objectContaining({ action: 'SHIFT_TASK_STATUS_CHANGED', actor: s.lead, taskId: task.id, at: expect.any(String), to: 'DONE' }),
    ]))
    expect(JSON.stringify(history.events)).not.toContain('Treść przykładowego zadania')

    await s.claims(s.staff)
    expect(await tx`SELECT id FROM public.shift_tasks WHERE id = ${task.id}`).toHaveLength(0)
    await s.deny(/SHIFT_HANDOVER_FORBIDDEN/, () => tx`SELECT public.read_shift_handover_audit(${s.shift}, ${date}::date, 0)`)
    await s.deny(/row-level security/i, () => tx`INSERT INTO public.shift_tasks
      (organization_id, shift_definition_id, shift_date, title, created_by)
      VALUES (${s.org}, ${s.shift}, ${date}, 'Zadanie spoza grafiku', ${s.staff})`)
  })
})

it('@REQ: NUR-SHIFT-CLOSURE requires the complete delivery manifest and ready projections', async () => {
  await rollback(async (tx) => {
    const s = await fixture(tx)
    const capture = async (projection: 'WAITING' | 'READY') => {
      const key = crypto.randomUUID()
      const [row] = await tx`INSERT INTO public.voice_captures
        (organization_id, source, source_key, storage_path, sha256, author_id, recorded_at, status)
        VALUES (${s.org}, 'APP_GENERAL', ${key}, ${s.org + '/' + key}, repeat('a',64), ${s.staff}, ${insideShift}, 'SEGMENTED')
        RETURNING id`
      const [segment] = await tx`INSERT INTO public.voice_segments
        (organization_id, capture_id, ordinal, start_ms, end_ms, assignment_status, author_id, author_attribution, projection_status)
        VALUES (${s.org}, ${row.id}, 0, 0, 1000, 'FACILITY', ${s.staff}, 'AUTHENTICATED_SESSION', ${projection}) RETURNING id`
      return { key, id: row.id as string, segmentId: segment.id as string }
    }
    const delivered = await capture('READY')
    const inProgress = await capture('WAITING')
    await s.claims(s.lead)

    const partial = await s.preview()
    await s.deny(/SHIFT_HANDOVER_EVIDENCE_REQUIRED/, () => s.approve(partial.revision, 'COMPLETE', null, [delivered.id]))
    await s.deny(/SHIFT_HANDOVER_EVIDENCE_REQUIRED/, () => s.approve(partial.revision, 'COMPLETE', null, [delivered.key, inProgress.key]))
    await s.deny(/SHIFT_HANDOVER_EVIDENCE_REQUIRED/, () => s.approve(partial.revision, 'COMPLETE', null, [delivered.key]))

    await tx`RESET ROLE`
    await tx`UPDATE public.voice_segments SET projection_status = 'READY' WHERE id = ${inProgress.segmentId}`
    await s.claims(s.lead)
    const complete = await s.preview()
    await s.deny(/SHIFT_HANDOVER_EVIDENCE_REQUIRED/, () => s.approve(complete.revision, 'COMPLETE', null, [delivered.key]))
    await s.deny(/SHIFT_HANDOVER_EVIDENCE_REQUIRED/, () => s.approve(complete.revision, 'COMPLETE', null, [delivered.key, inProgress.key, crypto.randomUUID()]))
    expect(await s.approve(complete.revision, 'COMPLETE', null, [delivered.key, inProgress.key])).toBe(1)
    expect(await s.preview()).toMatchObject({
      versions: [{ completeness: 'COMPLETE', expectedSourceIds: expect.arrayContaining([delivered.key, inProgress.key]) }],
    })

    await tx`RESET ROLE`
    const lateReceipt = await capture('READY')
    await s.claims(s.lead)
    const amendment = await s.preview()
    expect(amendment).toMatchObject({ latestVersion: 1, facts: [], canApprove: true, newReceipts: 1 })
    expect(await s.approve(amendment.revision, 'COMPLETE', null, [delivered.key, inProgress.key, lateReceipt.key])).toBe(2)
    expect(await s.preview()).toMatchObject({ canApprove: false, newReceipts: 0 })
  })
})

it('@REQ: NUR-SHIFT-CLOSURE rejects settling the original once a task has moved', async () => {
  await rollback(async (tx) => {
    const s = await fixture(tx)
    await s.claims(s.lead)
    const [task] = await tx`INSERT INTO public.shift_tasks
      (organization_id, shift_definition_id, shift_date, title, created_by, status)
      VALUES (${s.org}, ${s.shift}, ${date}, 'Zadanie testowe', ${s.lead}, 'TODO') RETURNING id`
    await s.approve((await s.preview()).revision)
    await s.deny(/SHIFT_TASK_ALREADY_CARRIED/, () => tx`SELECT public.settle_shift_task(${task.id}, 'DONE', NULL, NULL, NULL)`)
    await s.deny(/SHIFT_TASK_ALREADY_CARRIED/, () => tx`UPDATE public.shift_tasks SET status = 'DONE' WHERE id = ${task.id}`)
    await s.deny(/SHIFT_TASK_ALREADY_CARRIED/, () => tx`SELECT public.settle_shift_task(${task.id}, 'CANCELLED', 'Test', NULL, NULL)`)
    await s.claims(s.admin, 'org_admin')
    expect(await tx`SELECT status FROM public.shift_tasks WHERE id = ${task.id} OR carried_from_task_id = ${task.id}`)
      .toEqual([{ status: 'TODO' }, { status: 'TODO' }])
  })
})

it('@REQ: NUR-SHIFT-CLOSURE proposes an amendment for a late task and carries it only once', async () => {
  await rollback(async (tx) => {
    const s = await fixture(tx)
    await s.claims(s.lead)
    await s.approve((await s.preview()).revision)
    const [task] = await tx`INSERT INTO public.shift_tasks
      (organization_id, shift_definition_id, shift_date, title, created_by, status)
      VALUES (${s.org}, ${s.shift}, ${date}, 'Spóźnione zadanie', ${s.lead}, 'TODO') RETURNING id`
    const draft = await s.preview()
    expect(draft).toMatchObject({ latestVersion: 1, canApprove: true, facts: [], lateTaskIds: [task.id] })
    expect(await s.approve(draft.revision)).toBe(2)
    const approved = await s.preview()
    expect(approved).toMatchObject({ canApprove: false, lateTaskIds: [], versions: [
      { version: 2, previousVersion: 1, tasks: [{ id: task.id, carriedToTaskId: expect.any(String) }] },
      { version: 1, previousVersion: null, tasks: [] },
    ] })
    await s.claims(s.admin, 'org_admin')
    expect(await tx`SELECT status, shift_definition_id FROM public.shift_tasks WHERE carried_from_task_id = ${task.id}`)
      .toEqual([{ status: 'TODO', shift_definition_id: s.next }])
  })
})
