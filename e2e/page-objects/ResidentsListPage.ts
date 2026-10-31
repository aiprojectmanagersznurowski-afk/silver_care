import { Page, Locator } from '@playwright/test';

/**
 * Page Object listy podopiecznych w panelu administratora (/admin/residents).
 * @REQ: SUP-IMPERSONATION
 */
export class ResidentsListPage {
  readonly page: Page;
  readonly rows: Locator;
  readonly residentNames: Locator;
  readonly impersonationBanner: Locator;
  readonly mobileCards: Locator;
  readonly paginationSummary: Locator;
  readonly nextPageButton: Locator;
  readonly prevPageButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mobileCards = page.locator('[data-testid="resident-mobile-card"]');
    this.paginationSummary = page.locator('[data-testid="list-pagination-summary"]');
    this.nextPageButton = page.getByRole('button', { name: 'Następna strona' });
    this.prevPageButton = page.getByRole('button', { name: 'Poprzednia strona' });
    this.searchInput = page.getByRole('searchbox', { name: 'Szukaj podopiecznego' }).or(page.getByPlaceholder('Szukaj podopiecznego...'));
    this.rows = page.locator('[data-slot="table-body"] [data-slot="table-row"]');
    this.residentNames = this.rows.locator('[data-testid="resident-name"]');
    this.impersonationBanner = page.getByText('Działasz w trybie impersonacji');
  }

  async plantImpersonationCookie(value: string) {
    const url = new URL(this.page.url() === 'about:blank' ? 'http://localhost:3000' : this.page.url());
    await this.page.context().addCookies([{ name: 'sc_impersonation', value, domain: url.hostname, path: '/' }]);
  }

  /** Nagłówek kolumny tabeli po nazwie (sortowanie przyciskiem w środku). */
  columnHeader(name: string): Locator {
    return this.page.locator('[data-slot="table-header"]').getByRole('columnheader', { name });
  }

  async goto() {
    await this.page.goto('/admin/residents');
    await this.page.waitForLoadState('networkidle');
  }
}
