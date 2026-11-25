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
