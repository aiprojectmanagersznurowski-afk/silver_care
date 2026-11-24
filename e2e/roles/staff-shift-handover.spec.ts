import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { test, expect } from '../fixtures/base-test'
import { TEST_USERS } from '../fixtures/test-users'
import { ShiftTasksPage } from '../page-objects/ShiftTasksPage'

// @REQ: NUR-SHIFT-CLOSURE
// @REQ: NUR-SHIFT-PLAN-PRINT
// @REQ: NUR-TASKS
test('@REQ: NUR-SHIFT-CLOSURE — dwa dyżury, wydruk i spóźniony aneks', async ({ loginPage, page }) => {
  test.setTimeout(95_000)
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false })
  const day = '2020-11-18'
  const operation = randomUUID()
  const dayCode = 'NUR20-D-' + operation.slice(0, 6)
  const nightCode = 'NUR20-N-' + operation.slice(0, 6)
  const titles = { done: 'Uporządkować dyżurkę', carried: 'Przygotować świetlicę', personal: 'Sprawdzić zapas ręczników', late: 'Sprawdzić wyposażenie' }
  const nightText = 'Przygotowano dyżurkę nocną'
  const receivedAt = day + 'T19:40:00+01:00'
  const lateText = 'Dostarczono dodatkowe wyposażenie'
  const [admin] = await sql`SELECT id, raw_app_meta_data->>'organization_id' AS org
    FROM auth.users WHERE email = ${TEST_USERS.org_admin.email}`
  const [staff] = await sql`SELECT id FROM auth.users WHERE email = ${TEST_USERS.nurse.email}`
  const [resident] = await sql`SELECT id FROM public.residents WHERE organization_id = ${admin.org} AND archived_at IS NULL LIMIT 1`
  const [first, next] = await sql`INSERT INTO public.shift_definitions
    (organization_id, code, name, start_time, end_time, order_index) VALUES
    (${admin.org}, ${dayCode}, 'Przekazanie dzienne ' || ${operation.slice(0, 6)}, '07:00', '19:00', 951),
    (${admin.org}, ${nightCode}, 'Przekazanie nocne ' || ${operation.slice(0, 6)}, '19:00', '07:00', 952)
    RETURNING id`
  const factIds: string[] = []
  let deviceId: string | undefined
  let captureId: string | undefined
  const addFact = async (fact: string, segmentId: string, recordedAt: string) => {
    const [row] = await sql`INSERT INTO public.voice_sanitized_events
      (organization_id, segment_id, capture_source, scope, author_id, sanitized_text, matched_categories, recorded_at, metadata)
      VALUES (${admin.org}, ${segmentId}, 'DEVICE', 'facility', ${staff.id}, ${fact}, '{}',
        ${day + 'T' + recordedAt + ':00+01:00'}, '{"pipeline_stage":"REDACT"}') RETURNING id`
    factIds.push(row.id)
  }

  try {
    await sql`INSERT INTO public.shift_roster (organization_id, shift_definition_id, shift_date, user_id)
      VALUES (${admin.org}, ${next.id}, ${day}, ${staff.id})`
    await loginPage.loginAs('org_admin')
    await page.addInitScript(() => { window.print = () => { document.documentElement.dataset.printed = 'true' } })
    const tasks = new ShiftTasksPage(page)
    await tasks.goto(dayCode, day)
    await tasks.addTask(titles.done, resident.id)
    await expect(tasks.task(titles.done)).toContainText('Do zrobienia')
    await tasks.markDone(titles.done)
    await expect(tasks.task(titles.done).getByText('Wykonane', { exact: true })).toBeVisible()
    await tasks.addTask(titles.carried)
    await expect(tasks.task(titles.carried)).toContainText('Zadanie wspólne')

    await tasks.openHandover()
    const history = await tasks.openShiftHistory()
    await expect(history.getByRole('row', { name: /Zmieniono status zadania/ }).filter({ hasText: titles.done })).toContainText('Ręcznie z listy')
    await tasks.approveHandover('Dyktafon nadal synchronizuje')
    await expect(tasks.handover.getByText('Przekazanie, wersja 1', { exact: true })).toBeVisible()

    await tasks.goto(nightCode, day)
    await expect(tasks.task(titles.carried)).toContainText('Przeniesione z poprzedniej zmiany')
    await tasks.addTask(titles.personal, resident.id, staff.id)
    await expect(tasks.assigneeSelect(titles.personal)).toHaveValue(staff.id)
    await expect(tasks.task(titles.personal).getByRole('cell', { name: 'Zadanie wspólne', exact: true })).toHaveCount(0)
    await tasks.approvePlanButton.click()
    await expect(tasks.planStatus).toContainText('Plan zatwierdzony, wersja 1')
    await tasks.printLink.click()
    await expect(page.getByText(titles.personal, { exact: true })).toBeVisible()
    await tasks.printButton.click()
    await expect(page.locator('html')).toHaveAttribute('data-printed', 'true')

    await page.context().clearCookies()
    await page.clock.setFixedTime(new Date(day + 'T19:00:00+01:00'))
    await loginPage.loginAs('nurse')
    await tasks.goto(nightCode, day)
    await expect(tasks.task(titles.carried)).toBeVisible()
    await expect(tasks.task(titles.personal)).toBeVisible()
    await expect(page.getByRole('button', { name: /potwierdź odbiór/i })).toHaveCount(0)
    await tasks.showMyTasks()
    await expect(tasks.task(titles.personal)).toBeVisible()
    await expect(tasks.task(titles.carried)).toHaveCount(0)
    await tasks.goto(dayCode, day)
    await expect(tasks.task(titles.done)).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Zamknięcie zmiany' })).toHaveCount(0)

    const [device] = await sql`INSERT INTO public.voice_devices (organization_id, label, token_hash)
      VALUES (${admin.org}, ${operation}, encode(sha256(convert_to(${operation}, 'UTF8')), 'hex')) RETURNING id`
    deviceId = device.id
    const [capture] = await sql`INSERT INTO public.voice_captures
      (organization_id, source, source_key, storage_path, sha256, device_id, session_id, session_seq, recorded_at, received_at, status)
      VALUES (${admin.org}, 'DEVICE', ${operation}, ${admin.org + '/' + operation}, repeat('a',64), ${device.id},
        gen_random_uuid(), 2, ${day + 'T18:58:00+01:00'}, ${receivedAt}, 'SEGMENTED') RETURNING id`
    captureId = capture.id
    for (const [ordinal, time, text] of [[0, '18:58', lateText], [1, '19:02', nightText]] as const) {
      const [segment] = await sql`INSERT INTO public.voice_segments
        (organization_id, capture_id, ordinal, start_ms, end_ms, assignment_status, author_id,
         author_attribution, derived_start_at, projection_status)
        VALUES (${admin.org}, ${capture.id}, ${ordinal}, ${ordinal * 240000}, ${ordinal * 240000 + 1000},
          'FACILITY', ${staff.id}, 'MANUAL_SEGMENT_CORRECTION', ${day + 'T' + time + ':00+01:00'}, 'READY') RETURNING id`
      await addFact(text, segment.id, time)
    }

    await page.context().clearCookies()
    await page.clock.setFixedTime(new Date(receivedAt))
    await loginPage.loginAs('org_admin')
    await tasks.goto(dayCode, day)
    await tasks.openHandover()
    await tasks.addTask(titles.late)
    await expect(tasks.handover.getByRole('row').filter({ hasText: titles.late })).toBeVisible()
    await expect(tasks.handover.getByText(lateText, { exact: true })).toBeVisible()
    await expect(tasks.handover.getByText(nightText, { exact: true })).toHaveCount(0)
    await expect(tasks.completeOption).toBeDisabled()
    await tasks.openHandoverSource(lateText)
    await tasks.goto(dayCode, day)
    await tasks.openHandover()
    await tasks.approveHandover('Sprawdzenie pozostałych nagrań trwa', true)
    await expect(tasks.handover.getByText('Aneks, wersja 2', { exact: true })).toBeVisible()
    await expect(tasks.handover.getByText('Przekazanie, wersja 1', { exact: true })).toBeVisible()
    await expect(tasks.handover.getByRole('button', { name: /potwierdź odbiór/i })).toHaveCount(0)

    const events = await sql`SELECT action, performed_by, created_at, payload FROM public.audit_logs
      WHERE organization_id = ${admin.org} AND payload->>'shift_definition_id' IN (${first.id}, ${next.id})
        AND payload->>'shift_date' = ${day}`
    expect(events.map((e) => e.action)).toEqual(expect.arrayContaining([
      'SHIFT_TASK_CREATED', 'SHIFT_TASK_STATUS_CHANGED', 'SHIFT_TASK_ASSIGNEE_CHANGED',
      'SHIFT_TASK_CARRIED', 'SHIFT_PLAN_APPROVED', 'SHIFT_PLAN_PRINTED',
      'SHIFT_HANDOVER_APPROVED', 'SHIFT_HANDOVER_AMENDMENT_APPROVED',
    ]))
    expect(events.filter((e) => e.action.startsWith('SHIFT_')).every((e) => e.performed_by === admin.id && e.created_at)).toBe(true)
    expect(events.find((e) => e.action === 'SHIFT_PLAN_PRINTED')?.payload.version).toBe(1)
    expect(events.find((e) => e.action === 'SHIFT_HANDOVER_AMENDMENT_APPROVED')?.payload.previous_version).toBe(1)
    expect(JSON.stringify(events)).not.toContain(lateText)
    await tasks.goto(nightCode, day)
    await expect(tasks.task(titles.late)).toContainText('Przeniesione z poprzedniej zmiany')
    await expect(tasks.planStatus).toContainText('Plan wymaga ponownego zatwierdzenia')
    await tasks.openHandover()
    await expect(tasks.handover.getByText(nightText, { exact: true })).toBeVisible()
    await expect(tasks.handover.getByText(lateText, { exact: true })).toHaveCount(0)
  } finally {
    await sql`DELETE FROM private.shift_handover_versions WHERE shift_definition_id = ${first.id}`
      .catch((error) => { if (error.code !== '42P01') throw error })
    if (factIds.length) await sql`DELETE FROM public.voice_sanitized_events WHERE id IN ${sql(factIds)}`
    if (captureId) await sql`DELETE FROM public.voice_captures WHERE id = ${captureId}`
    if (deviceId) await sql`DELETE FROM public.voice_devices WHERE id = ${deviceId}`
    await sql`DELETE FROM public.shift_definitions WHERE id IN (${first.id}, ${next.id})`
    await sql.end()
  }
})
