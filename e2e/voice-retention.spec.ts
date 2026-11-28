import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { createClient } from '../apps/web/node_modules/@supabase/supabase-js'
import { OPERATIONAL_REPORT_ENGINE, VOICE_RETENTION } from '../packages/contracts/src/generated/voice'
import { AdminReportsConfigPage } from './page-objects/AdminReportsConfigPage'
import { LoginPage } from './page-objects/LoginPage'
import { StaffMfaPage } from './page-objects/StaffMfaPage'

class VoiceRetentionPage extends AdminReportsConfigPage {
  readonly field = this.page.getByRole('spinbutton', { name: 'Okres przechowywania nagrań w dniach' })
  readonly saveButton = this.page.getByRole('button', { name: 'Zapisz retencję nagrań' })

  async expectDays(days: number) {
    await expect(this.field).toHaveValue(String(days))
  }

  async submitDays(days: number) {
    await this.field.fill(String(days))
    await this.saveButton.click()
  }

  async saveDays(days: number) {
    await this.submitDays(days)
    await expect(this.page.getByRole('status').filter({ hasText: 'Zapisano retencję nagrań.' })).toBeVisible()
    await this.expectDays(days)
  }
}

const { minDays, ttlDays, maxDays } = VOICE_RETENTION

for (const role of ['super_admin', 'org_admin'] as const) {
  test(`@REQ: VOICE-RETENTION @REQ: SEC-MFA-STAFF @REQ: ORG-ISOLATION ${role} ustawia retencję tylko dla właściwej placówki`, async ({ page, baseURL }) => {
    test.setTimeout(120_000)
    const dbUrl = process.env.DATABASE_URL!
    const apiUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)!
    if (![dbUrl, apiUrl, baseURL!].every((url) => ['127.0.0.1', 'localhost'].includes(new URL(url).hostname))) {
      throw new Error('Voice retention tests require a local app and local Supabase')
    }
    const sql = postgres(dbUrl, { prepare: false })
    const api = createClient(apiUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const organizationId = randomUUID()
    const otherId = randomUUID()
    const email = `voice-${randomUUID()}@example.test`
    const password = `Test-${randomUUID()}!`
    let accountId: string | undefined
    try {
      await sql`INSERT INTO public.organizations (id, name)
        VALUES (${organizationId}, 'Test retencji A'), (${otherId}, 'Test retencji B')`
      const { data, error } = await api.auth.admin.createUser({
        email, password, email_confirm: true,
        app_metadata: role === 'org_admin' ? { role, organization_id: organizationId } : { role },
      })
      if (error || !data.user) throw new Error('Cannot create voice retention test account')
      accountId = data.user.id

      const login = new LoginPage(page)
      const mfa = new StaffMfaPage(page)
      await login.goto()
      await login.login(email, password)
      await mfa.expectChallenge()
      await mfa.enrollTotp()
      await page.waitForURL((url) => url.pathname.startsWith('/admin'))

      const retention = new VoiceRetentionPage(page)
      await retention.open(role === 'super_admin' ? organizationId : otherId)
      await retention.expectDays(ttlDays)
      await expect(retention.field).toHaveAttribute('min', String(minDays))
      await expect(retention.field).toHaveAttribute('max', String(maxDays))
      await expect(page.getByText(`Maksymalny okres to ${maxDays} dni.`, { exact: false })).toBeVisible()

      if (role === 'super_admin') {
        await page.goto(`/admin/reports?organizationId=${organizationId}&voiceRetention=saved`)
        await retention.expectDays(ttlDays)
        await expect(page.getByText('Zapisano retencję nagrań.', { exact: true })).toHaveCount(0)
        await retention.field.evaluate((field: HTMLInputElement) => { field.form!.noValidate = true })
        await retention.submitDays(maxDays + 1)
        await expect(page.getByRole('alert').filter({ hasText: 'Podaj pełną liczbę dni' })).toBeVisible()
        await retention.expectDays(ttlDays)
      }

      await retention.saveDays(minDays)
      await retention.open(role === 'super_admin' ? organizationId : otherId)
      await retention.expectDays(minDays)
      if (role === 'super_admin') {
        await retention.saveDays(maxDays)
        await retention.open(organizationId)
        await retention.expectDays(maxDays)
        await page.context().addCookies([{
          name: 'sc_impersonation', url: baseURL!, value: JSON.stringify({
            targetAdminId: randomUUID(), targetOrgId: organizationId, targetOrgName: 'Test retencji A',
            impersonatorId: accountId, startedAt: new Date().toISOString(),
          }),
        }])
        await retention.submitDays(minDays)
        await expect(page.getByRole('alert').filter({ hasText: 'Nie udało się zapisać retencji nagrań.' })).toBeVisible()
        await expect(retention.field).toHaveCount(0)
        await page.context().clearCookies({ name: 'sc_impersonation' })
        await retention.open(otherId)
        await retention.expectDays(ttlDays)
      } else {
        await sql`INSERT INTO public.organization_feature_flags (organization_id, feature_key, enabled, updated_by)
          VALUES (${organizationId}, ${OPERATIONAL_REPORT_ENGINE.moduleKey}, false, ${accountId})`
        await retention.submitDays(maxDays)
        await expect(page.getByRole('alert').filter({ hasText: 'Nie udało się zapisać retencji nagrań.' })).toBeVisible()
      }

      expect(await sql`SELECT organization_id, retention_days FROM public.voice_retention_settings
        WHERE organization_id IN (${organizationId}, ${otherId})`).toEqual([
        { organization_id: organizationId, retention_days: role === 'super_admin' ? maxDays : minDays },
      ])
      expect(await sql`SELECT performed_by, payload FROM public.audit_logs
        WHERE organization_id IN (${organizationId}, ${otherId}) AND action = 'VOICE_CAPTURE_RETENTION_CHANGED'
        ORDER BY created_at`).toEqual([
        { performed_by: accountId, payload: { previous_days: ttlDays, retention_days: minDays } },
        ...(role === 'super_admin'
          ? [{ performed_by: accountId, payload: { previous_days: minDays, retention_days: maxDays } }] : []),
      ])
    } finally {
      await sql`DELETE FROM public.organization_feature_flags WHERE organization_id = ${organizationId}`
      if (accountId) await api.auth.admin.deleteUser(accountId)
      await sql`DELETE FROM public.organizations o WHERE o.id IN (${organizationId}, ${otherId})
        AND NOT EXISTS (SELECT 1 FROM public.audit_logs a WHERE a.organization_id = o.id)`
      await sql.end()
    }
  })
}

test('@REQ: VOICE-RETENTION sprząta dane starsze od limitu placówki i zachowuje dane na granicy', async () => {
  const database = new URL(process.env.DATABASE_URL!)
  if (!['127.0.0.1', 'localhost'].includes(database.hostname)
    || database.username !== 'postgres' || database.pathname !== '/postgres') throw new Error('Local database required')
  const sql = postgres(database.toString(), { prepare: false })
  const rollback = Symbol('rollback')
  try {
    await sql.begin(async (tx) => {
      const policies = [minDays, ttlDays, maxDays].map((days) => ({ days, org: randomUUID(), user: randomUUID() }))
      const [short, , long] = policies
      for (const { org, user } of policies) {
        await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Test granicy retencji')`
        await tx`INSERT INTO auth.users (id, raw_app_meta_data)
          VALUES (${user}, jsonb_build_object('role', 'org_admin', 'organization_id', ${org}::uuid))`
      }
      await tx`INSERT INTO public.voice_retention_settings (organization_id, retention_days)
        VALUES (${short.org}, ${minDays}), (${long.org}, ${maxDays})`

      const report = randomUUID()
      const dailyLog = randomUUID()
      const event = randomUUID()
      const operational = randomUUID()
      const category = OPERATIONAL_REPORT_ENGINE.defaultCategories[0].code
      const fixtures = []
      for (const { org, user, days } of policies) {
        const resident = randomUUID()
        await tx`INSERT INTO public.residents (id, organization_id, first_name, last_name)
          VALUES (${resident}, ${org}, 'Test', 'Retencja')`
        if (org === short.org) {
          await tx`INSERT INTO public.daily_reports (id, resident_id, author_id, approved_by, status)
            VALUES (${report}, ${resident}, ${user}, ${user}, 'PUBLISHED')`
          await tx`INSERT INTO public.daily_logs (id, resident_id, nurse_id) VALUES (${dailyLog}, ${resident}, ${user})`
        }
        for (const secondsFromCutoff of [-1, 0, 1]) {
          const id = randomUUID()
          const path = `${org}/fixture/${id}`
          const transcript = `${org}/transcripts/${id}/fixture/0`
          const received = tx`now() - make_interval(days => ${days}, secs => ${-secondsFromCutoff})`
          await tx`INSERT INTO public.voice_captures
            (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at, received_at)
            VALUES (${id}, ${org}, 'APP_GENERAL', ${id}, ${path}, ${'a'.repeat(64)}, ${user}, ${received}, ${received})`
          await tx`INSERT INTO public.voice_segments
            (id, organization_id, capture_id, ordinal, start_ms, end_ms, transcript_path)
            VALUES (${id}, ${org}, ${id}, 0, 0, 1000, ${transcript})`
          await tx`INSERT INTO public.voice_assignment_queue (segment_id, organization_id, reasons)
            VALUES (${id}, ${org}, ARRAY['NO_MATCH'])`
          await tx`INSERT INTO public.voice_draft_notes (id, resident_id, nurse_id, audio_url, created_at)
            VALUES (${id}, ${resident}, ${user}, 'local-only', ${received})`
          if (org === short.org && secondsFromCutoff < 0) {
            await tx`INSERT INTO public.voice_sanitized_events (id, organization_id, segment_id, capture_source,
              scope, author_id, sanitized_text, matched_categories, recorded_at, metadata)
              VALUES (${event}, ${org}, ${id}, 'APP_GENERAL', 'facility', ${user}, 'Zdarzenie testowe',
                ARRAY[${category}], ${received}, '{"pipeline_stage":"CLASSIFY"}')`
            await tx`INSERT INTO public.operational_reports (id, organization_id, category_code,
              period_start, period_end, source_event_ids, content, status, ai_model, ai_prompt_version,
              ai_generated_at, approved_by, approved_at)
              VALUES (${operational}, ${org}, ${category}, now() - interval '1 day', now(), ARRAY[${event}::uuid],
                '{}', 'APPROVED', 'fixture', 'fixture', now(), ${user}, now())`
          }
          fixtures.push({ id, path, transcript, expired: secondsFromCutoff < 0 })
        }
      }

      await tx`SET LOCAL ROLE service_role`
      await tx`SELECT public.expire_voice_captures()`
      await tx`SELECT public.cleanup_expired_operational_reports(${short.org})`
      await tx`RESET ROLE`
      const ids = fixtures.map(({ id }) => id)
      const kept = fixtures.filter(({ expired }) => !expired).map(({ id }) => id).sort()
      expect((await tx`SELECT id FROM public.voice_captures WHERE id = ANY(${ids}::uuid[]) ORDER BY id`).map(({ id }) => id))
        .toEqual(kept)
      expect((await tx`SELECT id FROM public.voice_segments WHERE id = ANY(${ids}::uuid[]) ORDER BY id`).map(({ id }) => id))
        .toEqual(kept)
      expect((await tx`SELECT segment_id AS id FROM public.voice_assignment_queue WHERE segment_id = ANY(${ids}::uuid[]) ORDER BY segment_id`).map(({ id }) => id))
        .toEqual(kept)
      expect((await tx`SELECT id FROM public.voice_draft_notes WHERE id = ANY(${ids}::uuid[]) ORDER BY id`).map(({ id }) => id))
        .toEqual(kept)
      expect((await tx`SELECT path FROM public.voice_storage_deletions
        WHERE path = ANY(${fixtures.flatMap(({ path, transcript }) => [path, transcript])}::text[]) ORDER BY path`).map(({ path }) => path))
        .toEqual(fixtures.filter(({ expired }) => expired).flatMap(({ path, transcript }) => [path, transcript]).sort())
      expect(await tx`SELECT id, status FROM public.daily_reports WHERE id = ${report}`).toEqual([{ id: report, status: 'PUBLISHED' }])
      expect(await tx`SELECT id FROM public.daily_logs WHERE id = ${dailyLog}`).toEqual([{ id: dailyLog }])
      expect(await tx`SELECT id, segment_id FROM public.voice_sanitized_events WHERE id = ${event}`)
        .toEqual([{ id: event, segment_id: null }])
      expect(await tx`SELECT id, status, source_event_ids FROM public.operational_reports WHERE id = ${operational}`)
        .toEqual([{ id: operational, status: 'APPROVED', source_event_ids: [event] }])
      throw rollback
    }).catch((error: unknown) => { if (error !== rollback) throw error })
  } finally {
    await sql.end()
  }
})
