import { afterAll, expect, it } from 'vitest'
import postgres from 'postgres'

// @REQ: NUR-SHIFT-CLOSURE
const db = postgres(process.env.DATABASE_URL!, { prepare: false })
const date = '2026-11-18'
const insideShift = '2026-11-18T10:00:00+01:00'

afterAll(() => db.end())

async function fixture(tx: postgres.TransactionSql, shiftDate = date) {
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
    VALUES (${org.id}, ${shift.id}, ${shiftDate}, ${lead}, true), (${org.id}, ${next.id}, ${shiftDate}, ${staff}, false)`
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
      VALUES (${org.id}, 'APP_GENERAL', 'facility', ${lead}, 'Testowy fakt', '{}', ((${shiftDate}::date + TIME '10:00') AT TIME ZONE 'Europe/Warsaw'), '{"pipeline_stage":"REDACT"}')
      RETURNING id`
    await claims(lead)
    return row.id as string
  }
  const preview = async () => {
    const [row] = await tx`SELECT public.preview_shift_handover(${shift.id}, ${shiftDate}::date) AS result`
    return row.result
  }
  const approve = async (revision: string, completeness = 'UNKNOWN', reason: string | null = 'Trwa synchronizacja', expected: string[] = []) => {
    const [row] = await tx`SELECT public.approve_shift_handover(
      ${shift.id}, ${shiftDate}::date, ${revision}, ${completeness}, ${reason}, ${expected}::uuid[]) AS version`
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
      expect.objectContaining({ action: 'SHIFT_TASK_STATUS_CHANGED', actor: s.lead, taskId: task.id, at: expect.any(String), to: 'DONE', settlementMethod: 'MANUAL' }),
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
    const capture = async (projection: 'WAITING' | 'READY', recordedAt = insideShift) => {
      const key = crypto.randomUUID()
      const [row] = await tx`INSERT INTO public.voice_captures
        (organization_id, source, source_key, storage_path, sha256, author_id, recorded_at, status)
        VALUES (${s.org}, 'APP_GENERAL', ${key}, ${s.org + '/' + key}, repeat('a',64), ${s.staff}, ${recordedAt}, 'SEGMENTED')
        RETURNING id`
      const [segment] = await tx`INSERT INTO public.voice_segments
        (organization_id, capture_id, ordinal, start_ms, end_ms, assignment_status, author_id, author_attribution, projection_status, derived_start_at)
        VALUES (${s.org}, ${row.id}, 0, 0, 1000, 'FACILITY', ${s.staff}, 'AUTHENTICATED_SESSION', ${projection}, ${insideShift}) RETURNING id`
      return { key, id: row.id as string, segmentId: segment.id as string }
    }
    const delivered = await capture('READY')
    // The recorder was started on the previous shift. This segment belongs to the reviewed shift.
    const inProgress = await capture('WAITING', '2026-11-18T06:59:00+01:00')
    const declare = async (version: number, sources: string[], reference = crypto.randomUUID()) => {
      await tx`SET LOCAL ROLE service_role`
      await tx`SELECT public.register_shift_handover_manifest(${s.org}, ${s.shift}, ${date}::date,
        ${version}, ${reference}, ${sources}::uuid[])`
    }
    await s.claims(s.lead)
    const partial = await s.preview()
    await s.deny(/SHIFT_HANDOVER_EVIDENCE_REQUIRED/, () => s.approve(partial.revision, 'COMPLETE', null, [delivered.key]))
    await tx`RESET ROLE`
    await tx`UPDATE public.voice_segments SET projection_status = 'READY' WHERE id = ${inProgress.segmentId}`
    await s.claims(s.lead)
    const noManifest = await s.preview()
    // Submitting exactly the received keys is not an independent record.
    await s.deny(/SHIFT_HANDOVER_EVIDENCE_REQUIRED/,
      () => s.approve(noManifest.revision, 'COMPLETE', null, [delivered.key, inProgress.key]))
    expect(noManifest.audioCompleteness).toBe('UNKNOWN')
    const [acl] = await tx`SELECT has_function_privilege(current_user,
      'public.register_shift_handover_manifest(uuid,uuid,date,integer,uuid,uuid[])', 'EXECUTE') AS allowed`
    expect(acl.allowed).toBe(false)

    const missing = crypto.randomUUID()
    const firstManifest = crypto.randomUUID()
    await declare(1, [delivered.key, inProgress.key, missing], firstManifest)
    await s.claims(s.lead)
    const missingSource = await s.preview()
    expect(missingSource).toMatchObject({ audioCompleteness: 'PARTIAL', missingSources: 1 })
    await s.deny(/SHIFT_HANDOVER_EVIDENCE_REQUIRED/, () => s.approve(missingSource.revision, 'COMPLETE', null))
    expect(await s.approve(missingSource.revision, 'PARTIAL', 'Brak pliku z wykazu')).toBe(1)

    await tx`RESET ROLE`
    const lateReceipt = await capture('READY')
    await declare(2, [delivered.key, inProgress.key, lateReceipt.key])
    await declare(1, [delivered.key, inProgress.key, missing], firstManifest)
    await s.claims(s.lead)
    const amendment = await s.preview()
    expect(amendment).toMatchObject({ latestVersion: 1, canApprove: true, newReceipts: 1, audioCompleteness: 'COMPLETE' })
    expect(await s.approve(amendment.revision, 'COMPLETE', null)).toBe(2)
    expect(await s.preview()).toMatchObject({ canApprove: false, newReceipts: 0,
      versions: [{ completeness: 'COMPLETE', expectedSourceIds: expect.arrayContaining([delivered.key, inProgress.key, lateReceipt.key]) },
        { completeness: 'PARTIAL' }],
    })
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


it('@REQ: NUR-SHIFT-CLOSURE counts only verified fragments of a shift and applies a clock correction', async () => {
  await rollback(async (tx) => {
    const [{ day: localDate, offset }] = await tx`
      SELECT day::text, (extract(epoch FROM ((day + TIME '19:03')
        - ((day + TIME '19:03') AT TIME ZONE 'Europe/Warsaw' AT TIME ZONE 'UTC'))) / 60)::integer AS offset
      FROM (SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date - 1 AS day) period`
    const s = await fixture(tx, localDate)
    const at = (time: string) => `${localDate}T${time}:00${offset === 120 ? '+02:00' : '+01:00'}`
    const utc = (time: string) => new Date(at(time)).toISOString().slice(0, 19) + '+00:00'
    const [device] = await tx`INSERT INTO public.voice_devices (organization_id, label, token_hash)
      VALUES (${s.org}, 'Dyktafon testowy', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex')) RETURNING id`
    const capture = async (clock: string, status = 'SEGMENTED') => {
      const key = crypto.randomUUID()
      const [row] = await tx`INSERT INTO public.voice_captures
        (organization_id, source, source_key, storage_path, sha256, device_id, session_id, session_seq,
         recorded_at, received_at, clock_state, status)
        VALUES (${s.org}, 'DEVICE', ${key}, ${s.org + '/' + key}, repeat('a',64), ${device.id}, gen_random_uuid(),
          2, ${at('18:58')}, ${at('19:40')}, ${clock}, ${status}) RETURNING id`
      return { id: row.id as string, key }
    }
    const addSegment = async (id: string, ordinal: number, at: string | null, projection: string) => {
      const [row] = await tx`INSERT INTO public.voice_segments
        (organization_id, capture_id, ordinal, start_ms, end_ms, assignment_status, author_id, author_attribution,
         derived_start_at, projection_status, transcript_path)
        VALUES (${s.org}, ${id}, ${ordinal}, ${ordinal * 240000}, ${ordinal * 240000 + 1000},
          ${at ? 'FACILITY' : 'PENDING'}, ${s.lead}, 'MANUAL_SEGMENT_CORRECTION', ${at}, ${projection},
          ${s.org + '/test-transcript'}) RETURNING id`
      return row.id as string
    }
    const known = await capture('SYNCED')
    const day = await addSegment(known.id, 0, at('18:58'), 'READY')
    const night = await addSegment(known.id, 1, at('19:02'), 'WAITING')
    const unknown = await capture('UNKNOWN', 'RECEIVED')
    await tx`SET LOCAL ROLE service_role`
    const [lease] = await tx`SELECT processing_token FROM public.claim_voice_capture(${unknown.id})`
    await tx`SELECT public.finalize_voice_capture(${unknown.id}, ${lease.processing_token}, ${tx.json([{
      ordinal: 0, start_ms: 0, end_ms: 1000, author_id: s.lead, scope: 'FACILITY',
      transcript_path: s.org + '/test-transcript', reasons: [],
    }])})`
    await tx`RESET ROLE`
    const [queue] = await tx`SELECT q.segment_id, q.version, q.shift_definition_id, q.reasons
      FROM public.voice_assignment_queue q JOIN public.voice_segments s ON s.id = q.segment_id
      WHERE s.capture_id = ${unknown.id}`
    expect(queue).toMatchObject({ shift_definition_id: null, reasons: ['TIME_UNCERTAIN'] })
    const corrected = queue.segment_id as string
    const addFact = async (id: string, time: string) => {
      const [row] = await tx`INSERT INTO public.voice_sanitized_events
        (organization_id, segment_id, capture_source, scope, author_id, sanitized_text, matched_categories, recorded_at, metadata)
        VALUES (${s.org}, ${id}, 'DEVICE', 'facility', ${s.lead}, 'Fakt testowy', '{}', ${at(time)}, '{"pipeline_stage":"REDACT"}')
        RETURNING id`
      return row.id as string
    }
    // A stored event timestamp does not override the segment's verified start.
    const dayFact = await addFact(day, '19:02')
    await s.claims(s.admin, 'org_admin')
    const readNight = async () => (await tx`SELECT public.preview_shift_handover(${s.next}, ${localDate}::date) AS result`)[0].result
    const dayDraft = await s.preview()
    expect(dayDraft.facts).toEqual([expect.objectContaining({ id: dayFact, recordedAt: utc('18:58') })])
    expect(dayDraft.receipts).toEqual([expect.objectContaining({ sourceKey: known.key })])
    expect(dayDraft.pendingSources).toBe(0)
    expect(await readNight()).toMatchObject({ facts: [], pendingSources: 1, receipts: [] })

    const [review] = await tx`SELECT public.correct_voice_segment_time(${corrected}, ${queue.version}, gen_random_uuid(), 'VERIFIED_START',
      'STAFF_CONFIRMED', ${localDate + ' 19:03:00'}::text::timestamp, ${offset}, NULL, NULL) AS result`
    expect(review.result).toMatchObject({ corrected_at: utc('19:03'), shift_definition_id: s.next, shift_date: localDate, closed: true })
    expect(await readNight()).toMatchObject({ pendingSources: 2 })
    await tx`RESET ROLE`
    await tx`UPDATE public.voice_segments SET projection_status = 'READY' WHERE id IN (${night}, ${corrected})`
    const nightFact = await addFact(night, '19:02')
    const correctedFact = await addFact(corrected, '18:58')
    await s.claims(s.admin, 'org_admin')
    expect(await readNight()).toMatchObject({ pendingSources: 0,
      facts: [{ id: nightFact }, { id: correctedFact, recordedAt: utc('19:03') }],
      receipts: expect.arrayContaining([expect.objectContaining({ sourceKey: known.key }), expect.objectContaining({ sourceKey: unknown.key })]),
    })
    expect((await s.preview()).facts.map((f: { id: string }) => f.id)).toEqual([dayFact])
  })
})

it('@REQ: NUR-SHIFT-CLOSURE prepares at the buffer, retries idempotently and refreshes the late amendment', async () => {
  await rollback(async (tx) => {
    const s = await fixture(tx)
    const refresh = async (time: string) => {
      await tx`SET LOCAL ROLE service_role`
      const [row] = await tx`SELECT public.refresh_due_shift_handovers(30, ${date + 'T' + time + ':00+01:00'}, ${s.org}) AS count`
      return row.count
    }
    await refresh('19:29')
    await s.claims(s.lead)
    let draft = await s.preview()
    expect(draft).toMatchObject({ preparedAt: null, audioCompleteness: 'UNKNOWN' })
    expect(await s.approve(draft.revision)).toBe(1)

    await refresh('19:31')
    await s.claims(s.lead)
    draft = await s.preview()
    expect(draft).toMatchObject({ preparedAt: null, latestVersion: 1, canApprove: false })
    const lateId = await s.amendFact()
    expect(await refresh('19:42')).toBeGreaterThan(0)
    expect(await refresh('19:42')).toBe(0)
    await s.claims(s.lead)
    draft = await s.preview()
    expect(draft).toMatchObject({ preparedAt: expect.stringContaining('18:42:00'), latestVersion: 1,
      facts: [{ id: lateId }], audioCompleteness: 'UNKNOWN' })
    expect(await s.approve(draft.revision)).toBe(2)
    await refresh('19:43')
    await s.claims(s.lead)
    expect(await s.preview()).toMatchObject({ canApprove: false, preparedAt: null, versions: [{ version: 2 }, { version: 1 }] })
    const nextMorning = async (time: string) => {
      await tx`SET LOCAL ROLE service_role`
      await tx`SELECT public.refresh_due_shift_handovers(30, ${'2026-11-19T' + time + ':00+01:00'}, ${s.org})`
      await s.claims(s.admin, 'org_admin')
      return (await tx`SELECT public.preview_shift_handover(${s.next}, ${date}::date) AS result`)[0].result
    }
    expect(await nextMorning('07:29')).toMatchObject({ preparedAt: null, audioCompleteness: 'UNKNOWN' })
    expect(await nextMorning('07:30')).toMatchObject({ preparedAt: expect.stringContaining('2026-11-19T06:30:00'),
      audioCompleteness: 'UNKNOWN', canApprove: true })
  })
})
