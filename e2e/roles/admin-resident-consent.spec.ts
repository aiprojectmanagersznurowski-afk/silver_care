import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { test, expect } from '../fixtures/base-test'
import { ResidentProfilePage } from '../page-objects/ResidentProfilePage'

test('@REQ: CONSENT-GRANTOR kierownik zapisuje wyłącznie potwierdzony cel', async ({ loginPage, page }) => {
  const database = new URL(process.env.DATABASE_URL!)
  if (!['localhost', '127.0.0.1'].includes(database.hostname)) throw new Error('Tests require local Supabase')
  await loginPage.loginAs('org_admin')
  const profile = new ResidentProfilePage(page)
  await profile.openFirstFromList()
  await profile.tab('Bliscy i kontakty').click()
  await page.getByText('Zarejestruj udokumentowaną zgodę', { exact: true }).click()
  await page.getByLabel('Cel zgody').selectOption('family_report_access')
  await page.getByLabel('Kto wyraził zgodę').selectOption('resident_self')
  await page.getByLabel('Mam udokumentowaną zgodę na wybrany cel.').check()
  await page.getByRole('button', { name: 'Zapisz zgodę' }).click()
  await expect(page.getByText('Zapisano zgodę na wybrany cel.', { exact: true })).toBeVisible()
})

test('@REQ: CONSENT-GRANTOR kierownik zapisuje konto opiekuna prawnego', async ({ loginPage, page }) => {
  const database = new URL(process.env.DATABASE_URL!)
  if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.pathname !== '/postgres') {
    throw new Error('Tests require local Supabase')
  }
  const sql = postgres(database.toString(), { prepare: false })
  const guardian = randomUUID()
  try {
    await loginPage.loginAs('org_admin')
    const profile = new ResidentProfilePage(page)
    await profile.openFirstFromList()
    const resident = new URL(page.url()).pathname.split('/').at(-1)!
    const [row] = await sql`SELECT organization_id FROM public.residents WHERE id = ${resident}`
    await sql`INSERT INTO auth.users (id, raw_app_meta_data) VALUES (${guardian},
      ${sql.json({ role: 'legal_guardian', organization_id: row.organization_id })})`
    await sql`INSERT INTO public.resident_relative_links (resident_id, relative_user_id, relationship_code, role)
      VALUES (${resident}, ${guardian}, 'GUARDIAN', 'legal_guardian')`
    await page.reload()
    await profile.tab('Bliscy i kontakty').click()
    await page.getByText('Zarejestruj udokumentowaną zgodę', { exact: true }).click()
    await page.getByLabel('Cel zgody').selectOption('wellness_family_view')
    await page.getByLabel('Kto wyraził zgodę').selectOption(guardian)
    await page.getByLabel('Mam udokumentowaną zgodę na wybrany cel.').check()
    await page.getByRole('button', { name: 'Zapisz zgodę' }).click()
    await expect(page.getByText('Zapisano zgodę na wybrany cel.', { exact: true })).toBeVisible()
    expect(await sql`SELECT grantor_user_id FROM public.consent_ledger WHERE resident_id = ${resident}
      AND purpose = 'wellness_family_view' AND grantor_user_id = ${guardian}`).toHaveLength(1)
  } finally {
    await sql`DELETE FROM public.consent_ledger WHERE grantor_user_id = ${guardian}`
    await sql`DELETE FROM public.resident_relative_links WHERE relative_user_id = ${guardian}`
    await sql`DELETE FROM auth.users WHERE id = ${guardian}`
    await sql.end()
  }
})
