import { expect, type Page } from '@playwright/test'

export class VoiceOperationalReportsPage {
  constructor(readonly page: Page) {}

  async openReport() {
    await this.page.goto('/staff/reports/operational')
    await expect(this.page.getByRole('heading', { name: 'Raporty operacyjne', exact: true })).toBeVisible()
    await this.page.getByRole('link', { name: 'Otwórz raport' }).first().click()
    await expect(this.page.getByText('Brak zarejestrowanych zdarzeń w wybranym okresie.')).toBeVisible()
  }

  async approve() {
    await this.page.getByRole('button', { name: 'Zatwierdź raport operacyjny' }).click()
    await expect(this.page.getByText('Zatwierdzony', { exact: true })).toBeVisible()
  }
}
