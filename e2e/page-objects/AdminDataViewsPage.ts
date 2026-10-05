import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object widoków danych panelu administratora zbudowanych na komponentach
 * szablonu shadcn-admin: tabele (ui/table) i wykresy (ui/chart).
 * @REQ: UI-TEMPLATE-ALIGNMENT
 */
export class AdminDataViewsPage {
  readonly page: Page;
  readonly tables: Locator;
  readonly rawTables: Locator;
  readonly charts: Locator;
  readonly rawSelects: Locator;
  readonly nativeSelects: Locator;

  constructor(page: Page) {
    this.page = page;
    this.tables = page.locator('[data-slot="table"]');
    this.rawTables = page.locator('table:not([data-slot="table"])');
    this.charts = page.locator('[data-slot="chart"]');
    this.rawSelects = page.locator('select:not([data-slot="native-select"])');
    this.nativeSelects = page.locator('[data-slot="native-select"]');
  }

  async goto(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  async expectTableFromTemplate() {
    await expect(this.tables.first()).toBeVisible();
    await expect(this.rawTables).toHaveCount(0);
  }
}
