import { randomUUID } from 'node:crypto'
import { createClient } from '../apps/web/node_modules/@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { AdminReportsConfigPage } from './page-objects/AdminReportsConfigPage'
import { LoginPage } from './page-objects/LoginPage'
import { OrganizationFeatureFlagsPage } from './page-objects/OrganizationFeatureFlagsPage'

test('@REQ: VOICE-DOCK-REPORTS - administrator dodaje kategorię i retencję dla jednej placówki', async ({ page }) => {
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
  const organizationId = randomUUID()
  const otherId = randomUUID()
  const email = `report-${randomUUID()}@example.test`
  const password = `Test-${randomUUID()}!`
  let accountId: string | undefined
  try {
    await sql`INSERT INTO public.organizations (id, name)
      VALUES (${organizationId}, 'Fixture raporty A'), (${otherId}, 'Fixture raporty B')`
    const { data, error } = await api.auth.admin.createUser({
      email, password, email_confirm: true, app_metadata: { role: 'super_admin' },
    })
    if (!data.user || error) throw new Error('Cannot create test account')
    accountId = data.user.id
    const login = new LoginPage(page)
    await login.goto()
    await login.revealForm()
    await login.fillEmail(email)
    await login.fillPassword(password)
    await login.submit()
    await page.waitForURL('**/admin/organizations')
    const reports = new AdminReportsConfigPage(page)
    await reports.open(organizationId)
    const flags = new OrganizationFeatureFlagsPage(page)
    await flags.open(organizationId)
    await flags.confirmMfa()
    await reports.open(organizationId)
    await expect(reports.row('Raport audytowy')).toBeVisible()
    await reports.addCategory('fixture_category', 'Zużycie materiałów', '75')
    await reports.open(organizationId)
    await expect(reports.row('Zużycie materiałów')).toContainText('75')
    await reports.open(otherId)
    await expect(reports.row('Raport audytowy')).toBeVisible()
    await expect(reports.row('Zużycie materiałów')).toHaveCount(0)
  } finally {
    if (accountId) await api.auth.admin.deleteUser(accountId)
    await sql`DELETE FROM public.organizations o WHERE o.id IN (${organizationId}, ${otherId})
      AND NOT EXISTS (SELECT 1 FROM public.audit_logs a WHERE a.organization_id = o.id)`
    await sql.end()
  }
})
