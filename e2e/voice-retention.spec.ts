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
      const savedUrl = page.url()
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
        await sql`UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data
          || jsonb_build_object('organization_id', ${otherId}::uuid) WHERE id = ${accountId}`
        await page.goto(savedUrl)
        await expect(page.getByText('Zapisano retencję nagrań.', { exact: true })).toHaveCount(0)
        await sql`UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data
          || jsonb_build_object('organization_id', ${organizationId}::uuid) WHERE id = ${accountId}`
        await retention.open(otherId)
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
