import { randomUUID } from 'node:crypto'
import { createClient } from '../apps/web/node_modules/@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { LoginPage } from './page-objects/LoginPage'
import { VoiceAssignmentPage } from './page-objects/VoiceAssignmentPage'

test('@REQ: VOICE-RESIDENT-ASSIGN - kierownik po MFA rozstrzyga wyjątek, z dowodem audytowym', async ({ page }) => {
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
  } finally {
    await api.storage.from('voice-recordings').remove([path])
    await sql`DELETE FROM public.voice_captures WHERE id = ${capture}`
    if (author) await api.auth.admin.deleteUser(author)
    await sql`DELETE FROM public.organizations WHERE id = ${org}
      AND NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE organization_id = ${org})`
    await sql.end()
  }
})
