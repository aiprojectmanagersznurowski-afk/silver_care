import { randomUUID } from 'node:crypto'
import { createClient } from '../apps/web/node_modules/@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { LoginPage } from './page-objects/LoginPage'
import { VoiceAssignmentPage } from './page-objects/VoiceAssignmentPage'
import { VoiceFamilyFactsPage } from './page-objects/VoiceFamilyFactsPage'
import { VoiceOperationalReportsPage } from './page-objects/VoiceOperationalReportsPage'

test('@REQ: VOICE-RESIDENT-ASSIGN - kierownik rozstrzyga wyjątek i zatwierdza w osobnych ścieżkach @REQ: REPORT-APPROVAL @REQ: VOICE-DOCK-REPORTS', async ({ page }) => {
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
  const org = randomUUID()
  const capture = randomUUID()
  const segment = randomUUID()
  const resident = randomUUID()
  const fact = 'Podopieczna zjadła całe śniadanie.'
  const path = `${org}/transcripts/${capture}/fixture/0`
  const note = 'Unikalna treść syntetyczna do sprawdzenia.'
  const email = `voice-${randomUUID()}@example.test`
  const password = `Test-${randomUUID()}!`
  let author: string | undefined
  try {
    await sql`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture przypisanie')`
    const { data, error } = await api.auth.admin.createUser({
      email, password, email_confirm: true, app_metadata: { role: 'org_admin', organization_id: org },
      user_metadata: { full_name: 'Kierownik testowy' },
    })
    if (!data.user || error) throw new Error('Cannot create test account')
    author = data.user.id
    const [shift] = await sql`SELECT id FROM public.shift_definitions WHERE organization_id = ${org} LIMIT 1`
    await sql`INSERT INTO public.voice_captures
      (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at, status)
      VALUES (${capture}, ${org}, 'APP_GENERAL', ${capture}, ${org + '/fixture/' + capture}, ${'a'.repeat(64)}, ${author}, now(), 'SEGMENTED')`
    await sql`INSERT INTO public.voice_segments
      (id, organization_id, capture_id, ordinal, start_ms, end_ms, transcript_path, author_id, author_attribution)
      VALUES (${segment}, ${org}, ${capture}, 0, 0, 1000, ${path}, ${author}, 'AUTHENTICATED_SESSION')`
    await sql`INSERT INTO public.voice_assignment_queue (segment_id, organization_id, shift_definition_id, shift_date, reasons)
      VALUES (${segment}, ${org}, ${shift?.id ?? null}, ${shift ? '2026-11-22' : null}, ARRAY['NO_MATCH'])`
    const upload = await api.storage.from('voice-recordings').upload(path, Buffer.from(note), { contentType: 'text/plain' })
    if (upload.error) throw new Error('Cannot create test transcript')

    const login = new LoginPage(page)
    await login.goto()
    await login.login(email, password)
    await page.waitForURL((url) => !url.pathname.includes('/login'))
    const assignments = new VoiceAssignmentPage(page)
    await assignments.open()
    await expect(page.getByRole('heading', { name: 'Fragmenty do sprawdzenia' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sprawdź fragment' })).toHaveCount(0)
    await assignments.verifyMfa()
    await assignments.resolveFacility(segment, note)
    const [audit] = await sql`SELECT payload FROM public.audit_logs
      WHERE organization_id = ${org} AND action = 'VOICE_SEGMENT_RESOLVED'`
    expect(audit.payload).toMatchObject({ segment_id: segment, method: 'MANUAL', scope: 'FACILITY' })
    expect(JSON.stringify(audit.payload)).not.toContain(note)
    await sql`INSERT INTO public.residents (id, organization_id, first_name, last_name)
      VALUES (${resident}, ${org}, 'Anna', 'Testowa')`
    await sql`INSERT INTO public.voice_segment_proposals
      (segment_id, organization_id, capture_id, resident_id, author_id, recorded_at, time_state, behavioral_facts)
      VALUES (${randomUUID()}, ${org}, ${capture}, ${resident}, ${author}, now(), 'SYNCED', ARRAY[${fact}::text])`
    const family = new VoiceFamilyFactsPage(page)
    await family.open()
    await family.include(fact)
    const [report] = await sql`SELECT status, content FROM public.daily_reports WHERE resident_id = ${resident}`
    expect(report.status).toBe('DRAFT')
    expect(report.content.text).toContain(fact)
    const operational = await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE service_role`
      const [draft] = await tx`SELECT id FROM public.record_generated_operational_report(
        ${org}, 'audit_operational', '2026-11-18T00:00:00Z', '2026-11-19T00:00:00Z', '[]',
        '{"no_data":true,"summary":"Brak zarejestrowanych zdarzeń w wybranym okresie.","events":[],"action_items":[]}',
        'rule-based-no-data-v1', 'rule-based-no-data-v1', '2026-11-19T00:00:00Z')`
      return draft.id
    })
    const operationsPage = new VoiceOperationalReportsPage(page)
    await operationsPage.openReport()
    await operationsPage.approve()
    const [approved] = await sql`SELECT status, approved_by FROM public.operational_reports WHERE id = ${operational}`
    expect(approved).toEqual({ status: 'APPROVED', approved_by: author })
  } finally {
    await api.storage.from('voice-recordings').remove([path])
    await sql`DELETE FROM public.voice_captures WHERE id = ${capture}`
    await sql`DELETE FROM public.residents WHERE id = ${resident}`
    if (author) await api.auth.admin.deleteUser(author)
    await sql`DELETE FROM public.organizations WHERE id = ${org}
      AND NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE organization_id = ${org})`
    await sql.end()
  }
})
