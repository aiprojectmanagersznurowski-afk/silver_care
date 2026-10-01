import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla Planera Dnia i Agendy Personelu (/staff/agenda).
 */
export class StaffAgendaPage {
  readonly page: Page;
  readonly dateInput: Locator;
  readonly todayButton: Locator;
  readonly titleInput: Locator;
  readonly timeInput: Locator;
  readonly typeSelect: Locator;
  readonly residentSelect: Locator;
  readonly submitButton: Locator;
  readonly morningSection: Locator;
  readonly noonSection: Locator;
  readonly afternoonSection: Locator;
  readonly eveningSection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dateInput = page.locator('input[type="date"]').first();
    this.todayButton = page.locator('button:has-text("Dziś")');
    this.titleInput = page.locator('#agenda-title');
    this.timeInput = page.locator('#agenda-time');
    this.typeSelect = page.locator('#agenda-type');
    this.residentSelect = page.locator('#agenda-resident');
    this.submitButton = page.locator('button[type="submit"]:has-text("wpis")');
    this.morningSection = page.locator('[data-slot="morning"]');
    this.noonSection = page.locator('[data-slot="noon"]');
    this.afternoonSection = page.locator('[data-slot="afternoon"]');
    this.eveningSection = page.locator('[data-slot="evening"]');
  }

  async goto() {
    await this.page.goto('/staff/agenda');
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    await expect(this.titleInput).toBeVisible();
    await expect(this.timeInput).toBeVisible();
    await expect(this.typeSelect).toBeVisible();
  }

  async createItem(opts: { title: string; time: string; type: string; residentId?: string }) {
    await this.titleInput.fill(opts.title);
    await this.timeInput.fill(opts.time);
    await this.typeSelect.selectOption(opts.type);
    if (opts.residentId && (await this.residentSelect.isVisible())) {
      await this.residentSelect.selectOption(opts.residentId);
    }
    await this.submitButton.click();
  }
}
