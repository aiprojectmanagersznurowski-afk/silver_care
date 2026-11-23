import { expect, type Page } from '@playwright/test'
import { totp } from './OrganizationFeatureFlagsPage'

export class StaffMfaPage {
  constructor(private readonly page: Page) {}

  async openAudit() {
    await this.page.goto('/admin/audit?scope=shift')
  }

  async expectChallenge() {
    await expect(this.page).toHaveURL(/\/login\/mfa\?/)
    await expect(this.page.getByRole('heading', { name: 'Potwierdź logowanie' })).toBeVisible()
    await expect(this.page.getByRole('heading', { name: 'Rejestr audytowy' })).toHaveCount(0)
  }

  async enrollTotp() {
    await this.page.getByRole('button', { name: 'Skonfiguruj uwierzytelnianie' }).click()
    const secret = this.page.getByTestId('feature-flags-totp-secret')
    await expect(secret).toBeVisible()
    await this.page.getByLabel('Kod uwierzytelniający').fill(totp((await secret.textContent())!.trim()))
    await this.page.getByRole('button', { name: 'Potwierdź kod' }).click()
  }

  async expectAudit() {
    await expect(this.page).toHaveURL(/\/admin\/audit\?scope=shift$/)
    await expect(this.page.getByRole('heading', { name: 'Rejestr audytowy' })).toBeVisible()
    await expect(this.page.getByText('Nie udało się wczytać rejestru audytowego')).toHaveCount(0)
  }

  async expectVoiceQueue() {
    await this.page.goto('/voice/assignment')
    await expect(this.page.getByRole('heading', { name: 'Fragmenty do sprawdzenia' })).toBeVisible()
    await expect(this.page.getByText('Brak fragmentów do sprawdzenia')).toBeVisible()
  }
}
