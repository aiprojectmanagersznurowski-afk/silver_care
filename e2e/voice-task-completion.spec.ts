import { randomUUID } from 'node:crypto'
import { createClient } from '../apps/web/node_modules/@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { LoginPage } from './page-objects/LoginPage'
import { ShiftTasksPage } from './page-objects/ShiftTasksPage'
import { VoiceAssignmentPage } from './page-objects/VoiceAssignmentPage'

test('@REQ: NUR-TASKS-VOICE-COMPLETION kierownik z aal2 potwierdza dowód i nie dubluje decyzji', async ({ page }) => {
  test.setTimeout(120_000)
  const dbUrl = process.env.DATABASE_URL!
  const apiUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)!
  if (![dbUrl, apiUrl].every((url) => ['127.0.0.1', 'localhost'].includes(new URL(url).hostname))) {
    throw new Error('Tests require local Supabase')
  }
  const sql = postgres(dbUrl, { prepare: false })
  const api = createClient(apiUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const organization = randomUUID()
  const capture = randomUUID()
  const segment = randomUUID()
  const shift = randomUUID()
  const task = randomUUID()
  const evidence = randomUUID()
  const email = `voice-task-${randomUUID()}@example.test`
  const password = `Test-${randomUUID()}!`
  const quote = 'Przewietrzyłam świetlicę.'
  const title = 'Przewietrzyć świetlicę'
  const code = 'e2e-voice-task'
  let account: string | undefined
  try {
    await sql`INSERT INTO public.organizations (id, name) VALUES (${organization}, 'Fixture głosowe rozliczenie')`
    const { data: auth, error } = await api.auth.admin.createUser({
      email, password, email_confirm: true, app_metadata: { role: 'org_admin', organization_id: organization },
    })
    if (!auth.user || error) throw new Error('Cannot create test account')
    account = auth.user.id
    const [{ date }] = await sql`SELECT CURRENT_DATE::text AS date`
    await sql`INSERT INTO public.shift_definitions (id, organization_id, code, name, start_time, end_time)
      VALUES (${shift}, ${organization}, ${code}, 'Zmiana testowa', '07:00', '19:00')`
    await sql`INSERT INTO public.shift_tasks (id, organization_id, shift_definition_id, shift_date, title, source, status, created_by)
      VALUES (${task}, ${organization}, ${shift}, ${date}, ${title}, 'MANUAL', 'TODO', ${account})`
    await sql`INSERT INTO public.voice_captures
      (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at, status)
      VALUES (${capture}, ${organization}, 'APP_GENERAL', ${capture}, ${organization + '/fixture/' + capture}, ${'a'.repeat(64)}, ${account}, now(), 'SEGMENTED')`
    await sql`INSERT INTO public.voice_segments
      (id, organization_id, capture_id, ordinal, start_ms, end_ms, assignment_status, author_id, author_attribution)
      VALUES (${segment}, ${organization}, ${capture}, 0, 0, 1000, 'FACILITY', ${account}, 'AUTHENTICATED_SESSION')`
    await sql`INSERT INTO public.shift_task_voice_suggestions (
      id, organization_id, shift_definition_id, shift_date, task_id, segment_id, source_id, fragment_index, source_kind,
      author_id, author_attribution, recorded_at, received_at, task_updated_at, kind, quote)
      SELECT ${evidence}, t.organization_id, t.shift_definition_id, t.shift_date, t.id, ${segment}, ${segment}, 0,
        c.source, c.author_id, 'AUTHENTICATED_SESSION', c.recorded_at, c.received_at, t.updated_at, 'COMPLETED', ${quote}
      FROM public.shift_tasks t CROSS JOIN public.voice_captures c WHERE t.id = ${task} AND c.id = ${capture}`

    const login = new LoginPage(page)
    await login.goto()
    await login.login(email, password)
    await page.waitForURL((url) => !url.pathname.includes('/login'))
    const tasks = new ShiftTasksPage(page)
    await tasks.goto(code, date)
    expect((await tasks.voiceDecision(evidence)).status()).toBe(403)
    await expect(tasks.voiceEvidence(title, quote)).toHaveCount(0)

    await new VoiceAssignmentPage(page).verifyMfa()
    await expect(tasks.voiceEvidence(title, quote)).toBeVisible()
    await expect(tasks.task(title)).toContainText('Sesja webowa')
    const [retry] = await Promise.all([tasks.voiceDecision(evidence), tasks.confirmVoiceEvidence(title)])
    expect(retry.status()).toBe(200)
    await expect(tasks.task(title)).toContainText('Wykonane')
    const audits = await sql`SELECT payload FROM public.audit_logs
      WHERE organization_id = ${organization} AND action = 'VOICE_SHIFT_TASK_DECIDED'`
    expect(audits).toHaveLength(1)
    expect(audits[0].payload).toMatchObject({ task_id: task, evidence_id: evidence, decision: 'DONE' })
    expect(JSON.stringify(audits)).not.toContain(quote)
  } finally {
    await sql`DELETE FROM public.voice_captures WHERE id = ${capture}`
    await sql`DELETE FROM public.shift_tasks WHERE id = ${task}`
    await sql`DELETE FROM public.shift_definitions WHERE id = ${shift}`
    if (account) await api.auth.admin.deleteUser(account)
    await sql`DELETE FROM public.organizations WHERE id = ${organization}
      AND NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE organization_id = ${organization})`
    await sql.end()
  }
})
