import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla modułu zarządzania strukturą placówki (/admin/facility).
 * @REQ: ADM-FACILITY-MANAGE
 * @REQ: ADM-BED-ASSIGNMENT
 * @REQ: ADM-FACILITY-OCCUPANCY
 */
export class FacilityPage {
  readonly page: Page;
  readonly viewGridButton: Locator;
  readonly viewTableButton: Locator;
  readonly searchInput: Locator;
  readonly floorFilter: Locator;
  readonly sectorFilter: Locator;
  readonly sectorCells: Locator;
  readonly occupancyFilter: Locator;
  readonly roomCards: Locator;
  readonly roomTable: Locator;
  readonly bedsTable: Locator;
  readonly expandedBedRows: Locator;
  readonly optimizerButton: Locator;
  readonly optimizerSuggestions: Locator;
  readonly roomNumbers: Locator;
  readonly importExportButton: Locator;
  readonly voiceTabButton: Locator;
  readonly exportTabButton: Locator;
  readonly importTabButton: Locator;
  readonly addBedButtons: Locator;
  readonly bedLabelInput: Locator;
  readonly saveBedButton: Locator;
  readonly capacityWarning: Locator;
  readonly confirmCapacityButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.viewGridButton = page.locator('button:has-text("Kafelki")');
    this.viewTableButton = page.locator('button:has-text("Tabela")');
    this.searchInput = page.locator('input[placeholder*="Szukaj pokoju"]');
    this.floorFilter = page.locator('select[name="floorFilter"]');
    this.sectorFilter = page.locator('select[name="sectorFilter"]');
    this.sectorCells = page.locator('[data-testid="room-table"] [data-testid="room-sector"]');
    this.occupancyFilter = page.locator('select[name="occupancyFilter"]');
    this.roomCards = page.locator('[data-testid="room-card"]');
    this.roomTable = page.locator('[data-testid="room-table"]');
    this.bedsTable = page.locator('[data-testid="beds-table"]');
    this.expandedBedRows = page.locator('[data-testid="room-expanded-beds"]');
    this.optimizerButton = page.getByRole('button', { name: 'Optymalizuj przydział łóżek' });
    this.optimizerSuggestions = page.locator('[data-testid="bed-optimizer-suggestion"]');
    this.roomNumbers = page.locator('[data-testid="room-table"] [data-testid="room-number"]');
    this.importExportButton = page.getByRole('button', { name: 'Import / Eksport' });
    this.voiceTabButton = page.getByRole('button', { name: 'Dodaj głosowo' });
    this.exportTabButton = page.getByRole('button', { name: 'Eksport' });
    this.importTabButton = page.getByRole('button', { name: 'Import Excel (.xlsx)' });
    this.addBedButtons = page.locator('[data-testid="room-card"]').getByRole('button', { name: 'Dodaj łóżko' });
    this.bedLabelInput = page.locator('#label');
    this.saveBedButton = page.getByRole('button', { name: 'Zapisz' });
    this.capacityWarning = page.locator('[data-testid="capacity-limit-warning"]');
    this.confirmCapacityButton = page.getByRole('button', { name: 'Dodaj mimo przekroczenia limitu' });
  }

  /** Otwiera dialog „Dodaj łóżko” w pierwszym pokoju widoku kafelków i wpisuje oznaczenie. */
  async startAddingBed(label: string) {
    await this.switchToGrid();
    await this.addBedButtons.first().click();
    await this.bedLabelInput.fill(label);
    await this.saveBedButton.click();
  }

  /** Otwiera dialog Import / Eksport struktury placówki. */
  async openImportExport() {
    await this.importExportButton.click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
  }

  columnHeader(name: string): Locator {
    return this.roomTable.getByRole('columnheader', { name });
  }

  /** Otwiera optymalizator i czeka na koniec analizy (propozycje albo brak konfliktów). */
  async openOptimizer() {
    await this.optimizerButton.click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-testid="bed-optimizer-result"]')).toBeVisible({ timeout: 20000 });
  }

  /** Etykiety opcji filtra sektora bez pozycji „Wszystkie sektory”. */
  async sectorOptionLabels(): Promise<string[]> {
    const labels = await this.sectorFilter.locator('option:not([value="all"])').allInnerTexts();
    return labels.map((l) => l.trim());
  }

  async goto() {
    await this.page.goto('/admin/facility');
    await this.page.waitForLoadState('networkidle');
  }

  async switchToTable() {
    await this.viewTableButton.click();
    await expect(this.roomTable).toBeVisible();
  }

  async switchToGrid() {
    await this.viewGridButton.click();
    await expect(this.roomCards.first()).toBeVisible();
  }

  async filterByFloor(floor: string) {
    await this.floorFilter.selectOption(floor);
  }

  async filterByOccupancy(status: string) {
    await this.occupancyFilter.selectOption(status);
  }
}
