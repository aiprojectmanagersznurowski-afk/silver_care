import { expect, type Page } from '@playwright/test'

export class AdminReportsConfigPage {
  constructor(readonly page: Page) {}

  async open(organizationId: string) {
    await this.page.goto(`/admin/reports?organizationId=${organizationId}`)
    await expect(this.page.getByRole('heading', { name: 'Konfiguracja raportów operacyjnych' })).toBeVisible()
  }

  row(label: string) {
    return this.page.getByRole('row').filter({ hasText: label })
  }

  async addCategory(code: string, label: string, retention: string) {
    await this.page.getByRole('button', { name: 'Dodaj kategorię' }).click()
    await this.page.getByLabel('Kod kategorii').fill(code)
    await this.page.getByLabel('Nazwa kategorii').fill(label)
    await this.page.getByLabel('Retencja w dniach').fill(retention)
    await this.page.getByRole('button', { name: 'Zapisz kategorię' }).click()
    await expect(this.row(label)).toContainText(retention)
  }
}
