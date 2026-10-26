import { Page, Locator } from '@playwright/test';

/**
 * Page Object globalnej wyszukiwarki (Cmd/Ctrl+K).
 * @REQ: UI-ACCESSIBILITY
 */
export class GlobalSearchPage {
  readonly trigger: Locator;
  readonly dialog: Locator;
  readonly input: Locator;
  readonly listbox: Locator;
  readonly options: Locator;
  readonly liveRegion: Locator;
  readonly retryButton: Locator;

  constructor(private readonly page: Page) {
    this.trigger = page.locator('button[aria-label="Wyszukaj w systemie"]');
    this.dialog = page.locator('div[role="dialog"][aria-label="Globalna wyszukiwarka systemowa"]');
    this.input = this.dialog.locator('input[type="text"]');
    this.listbox = this.dialog.getByRole('listbox');
    this.options = this.dialog.getByRole('option');
    this.liveRegion = this.dialog.locator('[role="status"][aria-live="polite"]');
    this.retryButton = this.dialog.getByRole('button', { name: 'Spróbuj ponownie' });
  }

  async open() {
    await this.trigger.click();
    await this.dialog.waitFor({ state: 'visible' });
  }

  async search(query: string) {
    await this.input.fill(query);
  }
}
