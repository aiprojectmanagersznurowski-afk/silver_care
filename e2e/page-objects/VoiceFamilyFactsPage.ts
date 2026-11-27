import { expect, type Page } from '@playwright/test'

export class VoiceFamilyFactsPage {
  constructor(readonly page: Page) {}

  async open() {
    await this.page.goto('/staff/reports/voice-facts')
    await expect(this.page.getByRole('heading', { name: 'Fakty do raportów rodzinnych' })).toBeVisible()
  }

  async include(fact: string) {
    const row = this.page.getByRole('row').filter({ hasText: fact })
    await row.getByRole('button', { name: 'Uwzględnij w szkicu' }).click()
    await expect(row).toHaveCount(0)
  }
}
