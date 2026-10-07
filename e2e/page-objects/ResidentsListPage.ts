import { Page, Locator } from '@playwright/test';

/**
 * Page Object listy podopiecznych w panelu administratora (/admin/residents).
 * @REQ: SUP-IMPERSONATION
 */
export class ResidentsListPage {
  readonly page: Page;
  readonly rows: Locator;
  readonly impersonationBanner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.rows = page.locator('[data-slot="table-body"] [data-slot="table-row"]');
    this.impersonationBanner = page.getByText('Działasz w trybie impersonacji');
  }

  async plantImpersonationCookie(value: string) {
    const url = new URL(this.page.url() === 'about:blank' ? 'http://localhost:3000' : this.page.url());
    await this.page.context().addCookies([{ name: 'sc_impersonation', value, domain: url.hostname, path: '/' }]);
  }

  async goto() {
    await this.page.goto('/admin/residents');
    await this.page.waitForLoadState('networkidle');
  }
}
