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
  readonly occupancyFilter: Locator;
  readonly roomCards: Locator;
  readonly roomTable: Locator;
  readonly bedsTable: Locator;
  readonly expandedBedRows: Locator;
  readonly optimizerButton: Locator;
  readonly optimizerSuggestions: Locator;

  constructor(page: Page) {
    this.page = page;
    this.viewGridButton = page.locator('button:has-text("Kafelki")');
    this.viewTableButton = page.locator('button:has-text("Tabela")');
    this.searchInput = page.locator('input[placeholder*="Szukaj pokoju"]');
    this.floorFilter = page.locator('select[name="floorFilter"]');
    this.sectorFilter = page.locator('select[name="sectorFilter"]');
    this.occupancyFilter = page.locator('select[name="occupancyFilter"]');
    this.roomCards = page.locator('[data-testid="room-card"]');
    this.roomTable = page.locator('[data-testid="room-table"]');
    this.bedsTable = page.locator('[data-testid="beds-table"]');
    this.expandedBedRows = page.locator('[data-testid="room-expanded-beds"]');
    this.optimizerButton = page.getByRole('button', { name: 'Optymalizuj przydział łóżek' });
    this.optimizerSuggestions = page.locator('[data-testid="bed-optimizer-suggestion"]');
  }

  /** Otwiera optymalizator i czeka na koniec analizy (propozycje albo brak konfliktów). */
  async openOptimizer() {
    await this.optimizerButton.click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-testid="bed-optimizer-result"]')).toBeVisible({ timeout: 20000 });
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
