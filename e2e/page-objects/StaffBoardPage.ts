import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla Tablicy Personelu (/staff).
 */
export class StaffBoardPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly cardsViewButton: Locator;
  readonly quickRoundsButton: Locator;
  readonly agendaLink: Locator;
  readonly reportsLink: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.locator('input[placeholder="Szukaj podopiecznego..."]');
    this.cardsViewButton = page.locator('button:has-text("Karty")');
    this.quickRoundsButton = page.locator('button:has-text("Szybki obchód")');
    this.agendaLink = page.locator('a[href="/staff/agenda"]');
    this.reportsLink = page.locator('a[href="/staff/reports"]');
    this.logoutButton = page.locator('form[action="/auth/signout"] button[type="submit"]');
  }

  async goto() {
    await this.page.goto('/staff');
  }

  async expectStaffBoardLoaded() {
    await expect(this.searchInput).toBeVisible();
    await expect(this.cardsViewButton).toBeVisible();
  }

  async switchToRounds() {
    await this.quickRoundsButton.click();
    await expect(this.quickRoundsButton).toHaveClass(/bg-sage/);
  }

  async switchToCards() {
    await this.cardsViewButton.click();
    await expect(this.cardsViewButton).toHaveClass(/bg-white/);
  }

  async searchResident(name: string) {
    await this.searchInput.fill(name);
  }

  async navigateToAgenda() {
    await this.agendaLink.click();
    await this.page.waitForURL('**/staff/agenda');
  }

  async navigateToReports() {
    await this.reportsLink.click();
    await this.page.waitForURL('**/staff/reports');
  }

  async logout() {
    await this.logoutButton.first().click();
    await this.page.waitForURL('**/login');
  }
}
