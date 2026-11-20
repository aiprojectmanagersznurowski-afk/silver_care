import { randomUUID } from 'node:crypto'
import { createClient } from '../apps/web/node_modules/@supabase/supabase-js'
import { expect, test, type Browser, type Page } from '@playwright/test'
import postgres from 'postgres'
import { FEATURE_FLAGS, FEATURE_FLAGS_BY_KEY, FEATURE_FLAG_POLICY } from '../packages/contracts/src/generated/features'
import { LoginPage } from './page-objects/LoginPage'
import { OrganizationFeatureFlagsPage } from './page-objects/OrganizationFeatureFlagsPage'

const portal = 'module_family_portal'
const parent = 'module_residents_management'

async function login(page: Page, email: string, password: string) {
  const loginPage = new LoginPage(page)
  await loginPage.goto()
  await loginPage.login(email, password)
  await page.waitForURL((url) => url.pathname !== '/login')
}

test('@REQ: SUP-FEATURE-FLAGS - zmiana modułów, MFA, izolacja, kaskada i blokada podglądu', async ({ browser, page }) => {
  test.setTimeout(120_000)
  const dbUrl = process.env.DATABASE_URL!
  const apiUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)!
  const localHosts = ['127.0.0.1', 'localhost', '[::1]']
  if (![dbUrl, apiUrl].every((url) => url && localHosts.includes(new URL(url).hostname))) {
    throw new Error('Test flag wymaga lokalnej bazy i lokalnego Supabase Auth.')
  }
  const sql = postgres(dbUrl, { prepare: false })
  const supabase = createClient(apiUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const ids: string[] = []
  const organizations: string[] = []
  const contexts: Awaited<ReturnType<Browser['newContext']>>[] = []
  const password = `Flag-${randomUUID()}!`
  const createUser = async (role: string, organizationId?: string) => {
    const email = `flags-${randomUUID()}@example.test`
    const { data: { user }, error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true, app_metadata: { role, organization_id: organizationId },
    })
    if (!user || error) throw new Error('Nie udało się utworzyć konta do testu flag.')
    ids.push(user.id)
    return { email, id: user.id }
  }
  const createFacility = async () => {
    const [org] = await sql`INSERT INTO organizations (name) VALUES ('Test E2E flag') RETURNING id`
    organizations.push(org.id)
    const family = await createUser('family', org.id)
    const [resident] = await sql`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash)
      VALUES (${org.id}, 'Jan', 'Testowy', ${randomUUID()}) RETURNING id`
    await sql`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role)
      VALUES (${resident.id}, ${family.id}, 'SON', 'family')`
    await sql`INSERT INTO daily_reports (resident_id, author_id, status, content)
      VALUES (${resident.id}, ${family.id}, 'PUBLISHED', '{}'::jsonb)`
    return { org: org.id, resident: resident.id, family }
  }
  const newSession = async (email: string) => {
    const context = await browser.newContext()
    contexts.push(context)
    const session = await context.newPage()
    await login(session, email, password)
    return session
  }

  try {
    const a = await createFacility()
    const b = await createFacility()
    const operator = await createUser('super_admin')
    const manager = await createUser('org_admin', a.org)
    await login(page, operator.email, password)
    const flagsPage = new OrganizationFeatureFlagsPage(page)
    await flagsPage.open(a.org)

    await expect(flagsPage.table('Moduły placówki').getByRole('switch')).toHaveCount(9)
    await expect(flagsPage.table('Delegacja uprawnień dla Kierownika placówki').getByRole('switch')).toHaveCount(2)
    for (const flag of FEATURE_FLAGS) {
      await expect(flagsPage.toggle(flag.key)).toHaveAttribute('aria-checked', String(flag.defaultEnabled))
    }
    await expect(flagsPage.toggle(portal)).toBeDisabled()
    await flagsPage.confirmMfa()
    await flagsPage.toggle(portal).click()
    await expect(flagsPage.toggle(portal)).not.toBeChecked()

    const familyA = await newSession(a.family.email)
    await familyA.goto('/dashboard')
    await expect(familyA.locator('[data-slot="list-empty"]')).toContainText('Moduł niedostępny')
    await expect(familyA.getByRole('button', { name: 'Wyloguj się' })).toBeVisible()
    const denied = await familyA.request.get(`/api/residents/${a.resident}/report/latest`)
    expect(denied.status()).toBe(403)
    expect(await denied.json()).toMatchObject({ code: FEATURE_FLAG_POLICY.disabledErrorCode, feature: portal })

    const familyB = await newSession(b.family.email)
    const allowed = await familyB.request.get(`/api/residents/${b.resident}/report/latest`)
    expect(allowed.status()).toBe(200)
    expect(await allowed.json()).toMatchObject({ report: { status: 'PUBLISHED' } })

    const managerPage = await newSession(manager.email)
    await managerPage.goto('/admin/invitations')
    await expect(managerPage.locator('[data-slot="list-empty"]')).toContainText('Moduł niedostępny')
    await expect(managerPage.getByRole('link', { name: 'Zaproszenia', exact: true })).toHaveCount(0)
    await expect(managerPage.getByRole('link', { name: 'Wiadomości', exact: true })).toHaveCount(0)
    await expect(managerPage.getByRole('link', { name: 'Audyt', exact: true })).toHaveCount(1)

    await flagsPage.toggle(portal).click()
    await expect(flagsPage.toggle(portal)).toBeChecked()
    await flagsPage.toggle(parent).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(FEATURE_FLAGS_BY_KEY[portal].label)
    await expect(dialog).toContainText(FEATURE_FLAGS_BY_KEY.module_wearables_iot.label)
    await dialog.getByRole('button', { name: 'Wyłącz moduł' }).click()
    await expect(flagsPage.toggle(portal)).toBeDisabled()
    await expect(flagsPage.toggle(portal)).not.toBeChecked()
    await page.goto('/admin/audit')
    await expect(page.getByText(FEATURE_FLAG_POLICY.auditAction, { exact: true }).first()).toBeVisible()

    await flagsPage.open(a.org)
    await flagsPage.startPreview()
    await flagsPage.open(a.org)
    await expect(flagsPage.toggle('module_facility_management')).toBeDisabled()
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
    try {
      if (organizations.length) await sql`DELETE FROM organizations WHERE id IN ${sql(organizations)}`
      await Promise.all(ids.map((id) => supabase.auth.admin.deleteUser(id)))
    } finally {
      await sql.end()
    }
  }
})
