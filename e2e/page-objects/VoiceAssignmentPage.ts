import { expect, type Page } from '@playwright/test'

export class VoiceAssignmentPage {
  constructor(readonly page: Page) {}

  async open() {
    await this.page.goto('/voice/assignment')
  }

  async resolveFacility(segment: string, text: string) {
    await this.page.getByRole('link', { name: 'Sprawdź fragment' }).first().click()
    await expect(this.page).toHaveURL(new RegExp(segment))
    await expect(this.page.getByText(text, { exact: true })).toBeVisible()
    await expect(this.page.getByText(/Przyjęto w systemie/)).toBeVisible()
    await expect(this.page.getByText(/Sesja webowa/)).toBeVisible()
    await this.page.getByLabel('Przypisanie fragmentu').selectOption('FACILITY')
    await this.page.getByRole('button', { name: 'Zapisz decyzję' }).click()
    await expect(this.page.getByText('Brak fragmentów do sprawdzenia').filter({ visible: true })).toBeVisible()
  }
}
