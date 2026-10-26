import { Page, Locator } from '@playwright/test';

/**
 * Page Object widoku „Dane dzienne” (/admin/reports/daily).
 * @REQ: UI-TEMPLATE-ALIGNMENT
 */
export class DailyReportPage {
  readonly page: Page;
  /** Przyklejona pierwsza kolumna: nagłówek i komórki wierszy. */
  readonly stickyCells: Locator;

  constructor(page: Page) {
    this.page = page;
    this.stickyCells = page.locator('[data-slot="table"] :is(th, td).sticky');
  }

  async goto() {
    await this.page.goto('/admin/reports/daily');
    await this.page.waitForLoadState('networkidle');
  }

  /** Kolory tła przyklejonych komórek po wyliczeniu stylów. */
  async stickyBackgrounds(): Promise<string[]> {
    return this.stickyCells.evaluateAll((cells) => cells.map((c) => getComputedStyle(c).backgroundColor));
  }
}
