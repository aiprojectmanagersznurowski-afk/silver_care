import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla Rejestru Audytowego (/admin/audit).
 * Odpowiada za testowanie wymagań SEC-AUDIT-APPEND-ONLY oraz SEC-NO-PII-LOGS.
 */
export class AuditPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly table: Locator;
  readonly startDateInput: Locator;
  readonly endDateInput: Locator;
  readonly filterButton: Locator;
  readonly scopeSelect: Locator;
  readonly exportCsvButton: Locator;
  readonly exportJsonButton: Locator;
  readonly userIdHeaders: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Rejestr audytowy', exact: true });
    this.table = page.getByRole('table', { name: 'Tabela rejestru audytowego' });
    this.scopeSelect = page.getByLabel('Zakres zdarzeń');
    this.startDateInput = page.locator('input#audit-date-from, input[name="startDate"]');
    this.endDateInput = page.locator('input#audit-date-to, input[name="endDate"]');
    this.filterButton = page.locator('button:has-text("Filtruj")');
    this.exportCsvButton = page.locator('button:has-text("Eksportuj CSV"), button:has-text("Pobierz CSV")');
    this.exportJsonButton = page.locator('button:has-text("Eksportuj JSON"), button:has-text("Pobierz JSON")');
    this.userIdHeaders = page.locator('th:has-text("User ID"), th:has-text("Aktor")');
  }

  async goto() {
    await this.page.goto('/admin/audit');
  }

  async filterShiftEvents(startDate: string, endDate: string) {
    await this.scopeSelect.selectOption('shift');
    await this.startDateInput.fill(startDate);
    await this.endDateInput.fill(endDate);
    await this.filterButton.click();
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.table).toBeVisible();
  }

  async expectUserIdColumnVisible() {
    await expect(this.userIdHeaders.first()).toBeVisible();
  }

  async expectFilterControlsVisible() {
    await expect(this.startDateInput).toBeVisible();
    await expect(this.endDateInput).toBeVisible();
  }

  async expectExportControlsVisible() {
    await expect(this.exportCsvButton).toBeVisible();
  }
}
