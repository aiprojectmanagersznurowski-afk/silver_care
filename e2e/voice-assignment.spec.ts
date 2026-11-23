import { createHash, randomUUID } from 'node:crypto'
import { createClient } from '../apps/web/node_modules/@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { LoginPage } from './page-objects/LoginPage'
import { VoiceAssignmentPage } from './page-objects/VoiceAssignmentPage'
import { VoiceFamilyFactsPage } from './page-objects/VoiceFamilyFactsPage'
import { VoiceOperationalReportsPage } from './page-objects/VoiceOperationalReportsPage'

class VoiceAssignmentSourcePage extends VoiceAssignmentPage {
  async openSource(segment: string) {
    await this.page.goto(`/voice/assignment?segment=${segment}`)
    await expect(this.page.getByRole('form', { name: 'Korekta czasu nagrania' })).toBeVisible()
  }

  async setShift(shiftId: string) {
    const form = this.page.getByRole('form', { name: 'Korekta czasu nagrania' })
    await form.getByLabel('Ustalenie czasu').selectOption('SHIFT_ONLY')
    await form.getByLabel('Zmiana').selectOption(shiftId)
    await form.getByLabel('Data początku zmiany').fill('2026-10-24')
    await form.getByLabel('Podstawa decyzji').selectOption('ROSTER_VERIFIED')
    await form.getByRole('button', { name: 'Zapisz korektę' }).click()
    await expect(this.page.getByRole('region', { name: 'Decyzja o przypisaniu' })
      .getByText('Nocna · 2026-10-24', { exact: true })).toBeVisible()
  }

  async verifyStart() {
    const form = this.page.getByRole('form', { name: 'Korekta czasu nagrania' })
    await form.getByLabel('Ustalenie czasu').selectOption('VERIFIED_START')
    await form.getByLabel('Lokalny początek fragmentu').fill('2026-10-25T02:30')
    await expect(form.getByLabel('Przesunięcie UTC').locator('option[value="120"]')).toHaveCount(1)
    await form.getByLabel('Przesunięcie UTC').selectOption('60')
    await form.getByLabel('Podstawa decyzji').selectOption('SOURCE_VERIFIED')
    await form.getByRole('button', { name: 'Zapisz korektę' }).click()
    await expect(this.page.locator('time[datetime="2026-10-25T01:30:00+00:00"]')).toBeVisible()
  }

  async splitAtOneSecond() {
    const form = this.page.getByRole('form', { name: 'Podział fragmentu' })
    await form.getByLabel('Punkt podziału 1 (s)').fill('1')
    await form.getByRole('button', { name: 'Zatwierdź podział' }).click()
    await expect(this.page).toHaveURL(/\/voice\/assignment(?:\?page=1)?$/)
  }

  async resolveUnavailableSource(segment: string) {
    await this.page.goto(`/voice/assignment?segment=${segment}`)
    await expect(this.page.getByText('Źródło fragmentu jest niedostępne')).toBeVisible()
    const scope = this.page.getByLabel('Przypisanie fragmentu')
    await expect(scope.getByRole('option')).toHaveText(['Wybierz zakres', 'Nie do przypisania'])
    await scope.selectOption('UNASSIGNABLE')
    await this.page.getByRole('button', { name: 'Zapisz decyzję' }).click()
    await expect(this.page.getByText('Brak fragmentów do sprawdzenia')).toBeVisible()
  }
}

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
  const unavailableSegment = randomUUID()
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
    const assignments = new VoiceAssignmentSourcePage(page)
    await assignments.open()
    await expect(page.getByRole('heading', { name: 'Fragmenty do sprawdzenia' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sprawdź fragment' })).toHaveCount(0)
    await assignments.verifyMfa()
    await assignments.resolveFacility(segment, note)
    const [audit] = await sql`SELECT payload FROM public.audit_logs
      WHERE organization_id = ${org} AND action = 'VOICE_SEGMENT_RESOLVED'`
    expect(audit.payload).toMatchObject({ segment_id: segment, method: 'MANUAL', scope: 'FACILITY' })
    expect(JSON.stringify(audit.payload)).not.toContain(note)
    await sql`INSERT INTO public.voice_segments
      (id, organization_id, capture_id, ordinal, start_ms, end_ms, author_id, author_attribution)
      VALUES (${unavailableSegment}, ${org}, ${capture}, 1, 1000, 2000, ${author}, 'AUTHENTICATED_SESSION')`
    await sql`INSERT INTO public.voice_assignment_queue (segment_id, organization_id, reasons)
      VALUES (${unavailableSegment}, ${org}, ARRAY['MIXED_SEGMENT'])`
    await assignments.resolveUnavailableSource(unavailableSegment)
    const [closed] = await sql`SELECT assignment_status, projection_status FROM public.voice_segments
      WHERE id = ${unavailableSegment}`
    expect(closed).toEqual({ assignment_status: 'UNASSIGNABLE', projection_status: 'WAITING' })
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

function syntheticVoiceAudio() {
  const size = 64000
  const wav = Buffer.alloc(size + 44)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(size + 36, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(16000, 24)
  wav.writeUInt32LE(32000, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(size, 40)
  return wav
}

test('@REQ: VOICE-RESIDENT-ASSIGN kierownik koryguje czas i dzieli prywatny materiał w kolejce @REQ: SEC-MFA-STAFF', async ({ page }) => {
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
  const shift = randomUUID()
  const audioPath = `${org}/fixture/${capture}`
  const transcriptPath = `${org}/transcripts/${capture}/fixture/0`
  const email = `voice-correction-${randomUUID()}@example.test`
  const password = `Test-${randomUUID()}!`
  let author: string | undefined
  try {
    await sql`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture korekta czasu')`
    const { data } = await api.auth.admin.createUser({ email, password, email_confirm: true,
      app_metadata: { role: 'org_admin', organization_id: org }, user_metadata: { full_name: 'Kierownik testowy' } })
    if (!data.user) throw new Error('Cannot create test account')
    author = data.user.id
    await sql`INSERT INTO public.shift_definitions (id, organization_id, code, name, start_time, end_time)
      VALUES (${shift}, ${org}, 'fixture-night', 'Nocna', '20:00', '08:00')`
    const wav = syntheticVoiceAudio()
    const hash = createHash('sha256').update(wav).digest('hex')
    const audio = await api.storage.from('voice-recordings').upload(audioPath, wav, { contentType: 'audio/wav' })
    const transcript = await api.storage.from('voice-recordings').upload(transcriptPath, 'Pierwsza sprawa. Druga sprawa.',
      { contentType: 'text/plain' })
    expect(audio.error).toBeNull()
    expect(transcript.error).toBeNull()
    await sql`INSERT INTO public.voice_captures
      (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at, clock_state, status)
      VALUES (${capture}, ${org}, 'APP_GENERAL', ${capture}, ${audioPath}, ${hash}, ${author},
        '2026-10-25 03:00Z', 'UNKNOWN', 'SEGMENTED')`
    await sql`INSERT INTO public.voice_segments
      (id, organization_id, capture_id, ordinal, start_ms, end_ms, transcript_path, author_id, author_attribution)
      VALUES (${segment}, ${org}, ${capture}, 0, 0, 2000, ${transcriptPath}, ${author}, 'AUTHENTICATED_SESSION')`
    await sql`INSERT INTO public.voice_assignment_queue (segment_id, organization_id, reasons)
      VALUES (${segment}, ${org}, ARRAY['TIME_UNCERTAIN', 'MIXED_SEGMENT'])`

    const login = new LoginPage(page)
    await login.goto()
    await login.login(email, password)
    await page.waitForURL((url) => !url.pathname.includes('/login'))
    const assignments = new VoiceAssignmentSourcePage(page)
    await assignments.open()
    const input = { action: 'time', segmentId: segment, requestId: randomUUID(), expectedVersion: 0,
      mode: 'SHIFT_ONLY', shiftDefinitionId: shift, shiftDate: '2026-10-24', basis: 'ROSTER_VERIFIED' }
    expect((await page.request.post('/api/voice/assignment', { data: input })).status()).toBe(403)
    expect((await page.request.get(`/api/voice/assignment?segment=${segment}`)).status()).toBe(403)
    await assignments.verifyMfa()
    await expect(page.getByRole('link', { name: 'Sprawdź fragment' })).toBeVisible()
    await assignments.openSource(segment)
    await assignments.setShift(shift)
    await assignments.verifyStart()
    const response = await page.request.get(`/api/voice/assignment?segment=${segment}`)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('audio/wav')
    expect((await response.body()).length).toBe(wav.length)
    expect((await page.request.post('/api/voice/assignment', { data: input })).status()).toBe(409)
    await assignments.splitAtOneSecond()
    expect(await sql`SELECT start_ms, end_ms, transcription_status FROM public.voice_segments
      WHERE parent_segment_id = ${segment} ORDER BY start_ms`).toEqual([
      { start_ms: 0, end_ms: 1000, transcription_status: 'WAITING' },
      { start_ms: 1000, end_ms: 2000, transcription_status: 'WAITING' },
    ])
    await page.goto('/admin/audit?scope=shift')
    await expect(page.getByText('Korekta czasu nagrania', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Podział fragmentu nagrania', { exact: true })).toBeVisible()
  } finally {
    await api.storage.from('voice-recordings').remove([audioPath, transcriptPath])
    await sql`DELETE FROM public.voice_captures WHERE id = ${capture}`
    if (author) await api.auth.admin.deleteUser(author)
    await sql`DELETE FROM public.organizations WHERE id = ${org}
      AND NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE organization_id = ${org})`
    await sql.end()
  }
})
