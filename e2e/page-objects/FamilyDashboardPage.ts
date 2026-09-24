import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla Portalu Rodziny (/dashboard).
 */
export class FamilyDashboardPage {
  readonly page: Page;
  readonly emptyStateTitle: Locator;
  readonly emptyStateDescription: Locator;
  readonly logoutButton: Locator;

  // Linki w nagłówku
  readonly dashboardLink: Locator;
  readonly agendaLink: Locator;
  readonly messagesLink: Locator;
  readonly accountDropdown: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emptyStateTitle = page.locator('text=Brak powiązanych podopiecznych');
    this.emptyStateDescription = page.locator('text=Twoje konto nie zostało jeszcze przypisane do profilu podopiecznego');
    this.logoutButton = page.locator('button:has-text("Wyloguj się")');

    this.dashboardLink = page.locator('header a[href="/dashboard"]');
    this.agendaLink = page.locator('header a[href="/agenda"]');
    this.messagesLink = page.locator('header a[href="/messages"]');
    this.accountDropdown = page.locator('header button:has-text("Konto"), header button:has-text("Wyświetlany profil")');
  }


  async goto() {
    await this.page.goto('/dashboard');
  }

  async expectEmptyState() {
    await expect(this.emptyStateTitle).toBeVisible();
    await expect(this.emptyStateDescription).toBeVisible();
    await expect(this.logoutButton).toBeVisible();
  }

  async dismissOnboardingModalIfExists() {
    const confirmButton = this.page.locator('button:has-text("Rozumiem, przejdź do panelu")');
    try {
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click();
        await expect(confirmButton).toBeHidden({ timeout: 3000 });
      }
    } catch {
      // Jeśli modal się nie pojawił, ignorujemy
    }
  }

  async navigateToAgenda() {
    await this.dismissOnboardingModalIfExists();
    await this.agendaLink.click();
    await this.page.waitForURL('**/agenda');
  }

  async navigateToMessages() {
    await this.dismissOnboardingModalIfExists();
    await this.messagesLink.click();
    await this.page.waitForURL('**/messages');
  }

  async navigateToDashboard() {
    await this.dismissOnboardingModalIfExists();
    await this.dashboardLink.click();
    await this.page.waitForURL('**/dashboard');
  }

  /**
   * Sprawdza, czy na widoku rodziny NIE pojawiają się parametry fizjologiczne (MDR).
   */
  async expectMdrCompliant() {
    const content = (await this.page.textContent('body')) || '';
    const forbiddenPatterns = [
      /\btętno\b/i,
      /\bhrv\b/i,
      /\bheart[ _]?rate\b/i,
      /\bpuls\b/i,
    ];
    for (const pat of forbiddenPatterns) {
      expect(content).not.toMatch(pat);
    }
  }

  async logout() {
    await this.dismissOnboardingModalIfExists();
    // Jeśli widoczny jest przycisk wylogowania w Empty State
    if (await this.logoutButton.isVisible()) {
      await this.logoutButton.click();
    } else {
      await this.accountDropdown.click();
      const dropdownLogout = this.page.locator('button:has-text("Wyloguj się")');
      await expect(dropdownLogout).toBeVisible({ timeout: 5000 });
      await dropdownLogout.click();
    }
    await this.page.waitForURL('**/login');
  }
}


