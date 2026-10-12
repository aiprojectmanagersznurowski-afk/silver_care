import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla modułu Notatki Głosowej (/voice).
 */
export class VoiceNotePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly residentButtons: Locator;
  readonly backToStaffLink: Locator;
  readonly recordButton: Locator;
  readonly stopButton: Locator;
  readonly transcriptionTextarea: Locator;
  readonly buildReportButton: Locator;
  readonly restartButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h2:has-text("Notatka Głosowa")');
    this.searchInput = page.locator('input#search-resident');
    this.residentButtons = page.locator('button:has-text("Kliknij, aby nagrać")');
    this.backToStaffLink = page.locator('a:has-text("Wróć do tablicy dyżuru")');
    this.recordButton = page.locator('button:has(svg.lucide-mic)');
    this.stopButton = page.locator('button:has(svg.lucide-square)');
    this.transcriptionTextarea = page.locator('textarea');
    this.buildReportButton = page.locator('button:has-text("Buduj raport"), button:has-text("Zatwierdź uzupełnienie i buduj raport")');
    this.restartButton = page.locator('button:has-text("Zacznij od nowa")');
    this.errorMessage = page.locator('.text-destructive');
  }

  async goto() {
    await this.page.goto('/voice');
  }

  async expectResidentSelectionVisible() {
    await expect(this.heading).toBeVisible();
    await expect(this.searchInput).toBeVisible();
  }

  async selectFirstResident() {
    await expect(this.residentButtons.first()).toBeVisible();
    await this.residentButtons.first().click();
  }

  async expectRecordingControlsVisible() {
    await expect(this.recordButton).toBeVisible();
  }

  async startRecording() {
    await this.recordButton.click();
    await expect(this.stopButton).toBeVisible();
  }

  async stopRecording() {
    await this.stopButton.click();
  }

  async expectTranscriptionVisible(expectedText?: string) {
    await expect(this.transcriptionTextarea).toBeVisible();
    if (expectedText) {
      await expect(this.transcriptionTextarea).toHaveValue(new RegExp(expectedText));
    }
    await expect(this.buildReportButton).toBeVisible();
  }
}
