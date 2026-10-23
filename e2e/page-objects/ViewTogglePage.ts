import { Page, Locator } from '@playwright/test';

/**
 * Page Object przełącznika kafelki/tabela (patterns/ViewToggle).
 * @REQ: UI-TEMPLATE-ALIGNMENT
 */
export class ViewTogglePage {
  readonly toggle: Locator;
  readonly tableButton: Locator;
  readonly gridButton: Locator;

  constructor(private readonly page: Page) {
    this.toggle = page.locator('[data-slot="view-toggle"]:visible').first();
    this.tableButton = this.toggle.locator('button[aria-label="Widok tabeli"]');
    this.gridButton = this.toggle.locator('button[aria-label="Widok kafelków"]');
  }

  /** Otwiera widok bez zapamiętanych preferencji, żeby sprawdzić ustawienie domyślne. */
  async gotoFresh(path: string) {
    await this.page.goto(path);
    await this.page.evaluate(() => window.localStorage.clear());
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');
  }

  async pressedLabel(): Promise<string | null> {
    return this.toggle.locator('button[aria-pressed="true"]').getAttribute('aria-label');
  }

  async visibleTables(): Promise<number> {
    return this.page.evaluate(() =>
      [...document.querySelectorAll('main table')].filter((t) => (t as HTMLElement).offsetParent !== null).length,
    );
  }
}
