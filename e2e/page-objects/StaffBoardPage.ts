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
  readonly familyMessagesLinks: Locator;
  readonly buttonsNestedInLinks: Locator;
  readonly dictateLinks: Locator;
  /** Nazwisko podopiecznego jako link do jego karty w części personelu (SC-ADM-20). */
  readonly residentCardLinks: Locator;
  readonly tableRows: Locator;
  readonly paginationSummary: Locator;
  readonly nextPageButton: Locator;
  readonly prevPageButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.locator('input[placeholder="Szukaj podopiecznego..."]').first();
    this.cardsViewButton = page.locator('button:has-text("Karty")').first();
    this.quickRoundsButton = page.locator('button:has-text("Obchód"), button:has-text("Szybki obchód")').first();
    this.agendaLink = page.locator('a[href="/staff/agenda"]').first();
    this.reportsLink = page.locator('a[href="/staff/reports"]');
    this.logoutButton = page.locator('form[action="/auth/signout"] button[type="submit"]');
    this.familyMessagesLinks = page.locator('a[href^="/admin/messages?residentId="]');
    this.buttonsNestedInLinks = page.locator('a button');
    this.dictateLinks = page.locator('a[href^="/voice?resident="]');
    this.residentCardLinks = page.locator('main a[href^="/staff/residents/"]:visible');
    this.tableRows = page.locator('main [data-slot="table-body"] [data-slot="table-row"]');
    this.paginationSummary = page.locator('[data-testid="list-pagination-summary"]');
    this.nextPageButton = page.getByRole('button', { name: 'Następna strona' });
    this.prevPageButton = page.getByRole('button', { name: 'Poprzednia strona' });
  }

  async goto() {
    await this.page.goto('/staff');
  }

  /** Nagłówek kolumny tabeli tablicy dyżuru (sortowanie przyciskiem w środku). */
  columnHeader(name: string): Locator {
    return this.page.locator('main [data-slot="table-header"]').getByRole('columnheader', { name });
  }

  /** Nazwy podopiecznych w kolejności wierszy tabeli. */
  async tableResidentNames(): Promise<string[]> {
    const names = await this.page.locator('main [data-slot="table-body"] a[href^="/staff/residents/"]').allInnerTexts();
    return names.map((n) => n.trim());
  }

  async expectStaffBoardLoaded() {
    await expect(this.searchInput).toBeVisible();
    await expect(this.cardsViewButton).toBeVisible();
  }

  async switchToRounds() {
    await this.quickRoundsButton.click();
    await expect(this.quickRoundsButton).toHaveAttribute('aria-pressed', 'true');
  }

  async switchToCards() {
    await this.cardsViewButton.click();
    await expect(this.cardsViewButton).toHaveAttribute('aria-pressed', 'true');
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
    // Wylogowanie jest w rozwijanym menu konta w stopce paska bocznego (nav-user szablonu)
    await this.page.locator('[data-slot="sidebar"] [data-slot="nav-user-trigger"]').click();
    await this.logoutButton.first().click();
    await this.page.waitForURL('**/login');
  }
}
