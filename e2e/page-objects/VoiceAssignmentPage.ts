import { expect, type Page } from '@playwright/test'

export class VoiceAssignmentPage {
  constructor(readonly page: Page) {}

  async open() {
    await this.page.goto('/voice/assignment')
  }

  async openSegment(segment: string) {
    await this.page.goto(`/voice/assignment?segment=${segment}`)
  }

  async expectSelectedResident(name: string, canConfirm: boolean) {
    const scope = this.page.getByLabel('Przypisanie fragmentu')
    await expect(scope.getByRole('option')).toHaveText(canConfirm
      ? ['Wybierz zakres', 'Potwierdź wybranego podopiecznego', 'Nie do przypisania']
      : ['Wybierz zakres', 'Nie do przypisania'])
    await expect(this.page.getByLabel('Autor fragmentu', { exact: true })).toHaveCount(0)
    if (canConfirm) {
      await expect(this.page.getByText(`Wybrany podopieczny: ${name}`, { exact: true })).toBeVisible()
      await scope.selectOption('RESIDENT')
      await expect(this.page.getByRole('combobox', { name: 'Podopieczny', exact: true })).toHaveCount(0)
    }
  }

  async saveSelectedResident() {
    await this.page.getByRole('button', { name: 'Zapisz decyzję' }).click()
    await expect(this.page).toHaveURL(/\/voice\/assignment(?:\?page=1)?$/)
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
