import { expect, type Page } from '@playwright/test'
import { OrganizationFeatureFlagsPage, totp } from './OrganizationFeatureFlagsPage'

export class VoiceAssignmentPage {
  constructor(readonly page: Page) {}

  async open() {
    await this.page.goto('/voice/assignment')
  }

  async verifyMfa() {
    const secret = await new OrganizationFeatureFlagsPage(this.page).startMfaEnrollment()
    await this.page.getByLabel('Kod uwierzytelniający').fill(totp((await secret.textContent())!.trim()))
    await this.page.getByRole('button', { name: 'Potwierdź kod' }).click()
  }

  async resolveFacility(segment: string, text: string) {
    await this.page.getByRole('link', { name: 'Sprawdź fragment' }).first().click()
    await expect(this.page).toHaveURL(new RegExp(segment))
    await expect(this.page.getByText(text, { exact: true })).toBeVisible()
    await expect(this.page.getByText(/Przyjęto w systemie/)).toBeVisible()
    await expect(this.page.getByText(/Sesja webowa/)).toBeVisible()
    await this.page.getByLabel('Przypisanie fragmentu').selectOption('FACILITY')
    await this.page.getByRole('button', { name: 'Zapisz decyzję' }).click()
    await expect(this.page.getByText('Brak fragmentów do sprawdzenia')).toBeVisible()
  }
}
