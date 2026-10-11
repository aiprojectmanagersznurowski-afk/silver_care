import { test, expect } from './fixtures/base-test';
import { AdminResidentsExportImportPage } from './page-objects/AdminResidentsExportImportPage';

/**
 * @REQ: ADM-FACILITY-MANAGE
 * @REQ: ADM-RESIDENT-ADD
 * @REQ: UI-ACCESSIBILITY
 *
 * Testy E2E dla eksportu danych placówki oraz masowego importu pensjonariuszy:
 * AC1: Otwarcie dialogu eksportu, zmiana formatu (CSV/XLSX), filtrów statusu i ZSN.
 * AC2: Dialog pobierania wzorca i masowego importu pensjonariuszy.
 */
test.describe('Eksport danych placówki i masowy import (@REQ: ADM-FACILITY-MANAGE, @REQ: ADM-RESIDENT-ADD, @REQ: UI-ACCESSIBILITY)', () => {
  test('@REQ: ADM-FACILITY-MANAGE - AC1: Konfiguracja eksportu podopiecznych z filtrami i formatami', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const exportImportPage = new AdminResidentsExportImportPage(page);
    await exportImportPage.goto();

    // 1. Otwarcie modalu eksportu
    await exportImportPage.openExportDialog();

    // 2. Weryfikacja kontrolek i przełączania formatów
    await expect(exportImportPage.exportFormatXlsx).toBeVisible();
    await expect(exportImportPage.exportFormatCsv).toBeVisible();

    await exportImportPage.selectExportFormat('csv');
    await expect(exportImportPage.exportFormatCsv).toHaveClass(/border-primary/);

    await exportImportPage.selectExportFormat('xlsx');
    await expect(exportImportPage.exportFormatXlsx).toHaveClass(/border-primary/);

    // 3. Weryfikacja filtra ZSN i statusu
    await expect(exportImportPage.exportStatusSelect).toBeVisible();
    await exportImportPage.exportStatusSelect.selectOption('all');
    await expect(exportImportPage.exportStatusSelect).toHaveValue('all');

    await exportImportPage.exportZsnCheckbox.check();
    await expect(exportImportPage.exportZsnCheckbox).toBeChecked();

    // 4. Przycisk pobrania jest aktywny i dostępny
    await expect(exportImportPage.exportSubmitButton).toBeEnabled();
  });

  test('@REQ: ADM-RESIDENT-ADD - AC2: Otwarcie kreatora masowego importu i pobieranie formatki Excel', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const exportImportPage = new AdminResidentsExportImportPage(page);
    await exportImportPage.goto();

    // 1. Otwarcie modalu masowego importu
    await exportImportPage.openBulkImportDialog();

    // 2. Sprawdzenie obecności przycisku formatki wzorcowej i strefy drop-zone
    await expect(exportImportPage.bulkDownloadTemplateMain).toBeVisible();
    await expect(exportImportPage.bulkFileInput).toBeAttached();

    // 3. Sprawdzenie pobierania formatki przy zdarzeniu download
    const downloadPromise = page.waitForEvent('download');
    await exportImportPage.bulkDownloadTemplateMain.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('formatka_importu_podopiecznych.xlsx');
  });
});
