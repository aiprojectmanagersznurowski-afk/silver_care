import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla modułów Eksportu Danych oraz Masowego Importu w /admin/residents.
 * @REQ: ADM-FACILITY-MANAGE
 * @REQ: ADM-RESIDENT-ADD
 * @REQ: UI-ACCESSIBILITY
 */
export class AdminResidentsExportImportPage {
  readonly page: Page;
  readonly exportTrigger: Locator;
  readonly exportDialog: Locator;
  readonly exportFormatCsv: Locator;
  readonly exportFormatXlsx: Locator;
  readonly exportStatusSelect: Locator;
  readonly exportZsnCheckbox: Locator;
  readonly exportSubmitButton: Locator;
  readonly exportSuccessMessage: Locator;
  readonly exportErrorMessage: Locator;

  readonly bulkImportTrigger: Locator;
  readonly bulkImportDialog: Locator;
  readonly bulkDownloadTemplateMain: Locator;
  readonly bulkFileInput: Locator;
  readonly bulkCommitButton: Locator;
  readonly capacityWarningBanner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.exportTrigger = page.locator('[data-testid="export-data-trigger"]');
    this.exportDialog = page.locator('[data-testid="export-data-dialog"]');
    this.exportFormatCsv = page.locator('[data-testid="export-format-csv"]');
    this.exportFormatXlsx = page.locator('[data-testid="export-format-xlsx"]');
    this.exportStatusSelect = page.locator('[data-testid="export-status-select"]');
    this.exportZsnCheckbox = page.locator('[data-testid="export-zsn-checkbox"]');
    this.exportSubmitButton = page.locator('[data-testid="export-submit-button"]');
    this.exportSuccessMessage = page.locator('[data-testid="export-success-message"]');
    this.exportErrorMessage = page.locator('[data-testid="export-error-message"]');

    this.bulkImportTrigger = page.locator('[data-testid="bulk-import-trigger"]');
    this.bulkImportDialog = page.locator('[data-testid="bulk-import-dialog"]');
    this.bulkDownloadTemplateMain = page.locator('[data-testid="bulk-download-template-main"]');
    this.bulkFileInput = page.locator('[data-testid="bulk-file-input"]');
    this.bulkCommitButton = page.locator('[data-testid="bulk-commit-button"]');
    this.capacityWarningBanner = page.locator('[data-testid="capacity-warning-banner"]');
  }

  async goto() {
    await this.page.goto('/admin/residents');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async openExportDialog() {
    await this.exportTrigger.click();
    await expect(this.exportDialog).toBeVisible();
  }

  async selectExportFormat(format: 'xlsx' | 'csv') {
    if (format === 'csv') {
      await this.exportFormatCsv.click();
    } else {
      await this.exportFormatXlsx.click();
    }
  }

  async openBulkImportDialog() {
    await this.bulkImportTrigger.click();
    await expect(this.bulkImportDialog).toBeVisible();
  }
}
