import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object ekranu „Zmiany i grafik” kierownika placówki (/admin/shifts).
 * @REQ: NUR-SHIFT-CONFIG
 */
export class ShiftsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly rows: Locator;
  readonly addButton: Locator;
  readonly nameInput: Locator;
  readonly startInput: Locator;
  readonly endInput: Locator;
  readonly saveButton: Locator;
  readonly formError: Locator;
  readonly countHint: Locator;
  readonly weekLabel: Locator;
  readonly nextWeekLink: Locator;
  readonly prevWeekLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator(':is(h1, h2):has-text("Zmiany i grafik")');
    this.rows = page.locator('[data-testid="shift-definition-row"]');
    this.addButton = page.getByRole('button', { name: 'Dodaj zmianę' });
    this.nameInput = page.locator('#shift-name');
    this.startInput = page.locator('#shift-start');
    this.endInput = page.locator('#shift-end');
    this.saveButton = page.getByRole('button', { name: 'Zapisz zmianę' });
    this.formError = page.locator('[data-testid="shift-form-error"]');
    this.countHint = page.locator('[data-testid="shift-count-hint"]');
    this.weekLabel = page.locator('[data-testid="roster-week-label"]');
    this.nextWeekLink = page.getByRole('link', { name: 'Następny tydzień' });
    this.prevWeekLink = page.getByRole('link', { name: 'Poprzedni tydzień' });
  }

  async goto() {
    await this.page.goto('/admin/shifts');
    await this.page.waitForLoadState('networkidle');
  }

  rowFor(name: string): Locator {
    return this.rows.filter({ hasText: name });
  }

  async addShift(name: string, start: string, end: string) {
    await this.addButton.click();
    await this.nameInput.fill(name);
    await this.startInput.fill(start);
    await this.endInput.fill(end);
    await this.saveButton.click();
  }

  async toggleActive(name: string) {
    await this.rowFor(name).getByRole('button', { name: /Dezaktywuj|Aktywuj/ }).click();
  }

  /** Komórka grafiku: dzień (RRRR-MM-DD) i kod zmiany. */
  cell(date: string, shiftCode: string): Locator {
    return this.page.locator(`[data-testid="roster-cell-${date}-${shiftCode}"]`);
  }

  entry(date: string, shiftCode: string, who: string): Locator {
    return this.cell(date, shiftCode).locator('[data-testid="roster-entry"]').filter({ hasText: who });
  }

  async addToRoster(date: string, shiftCode: string, userId: string) {
    const cell = this.cell(date, shiftCode);
    await cell.getByLabel('Dodaj osobę do grafiku').selectOption(userId);
    await cell.getByRole('button', { name: 'Dodaj do grafiku' }).click();
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }
}
