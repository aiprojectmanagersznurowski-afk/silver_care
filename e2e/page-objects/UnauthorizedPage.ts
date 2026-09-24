import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla strony błędu uprawnień (/unauthorized).
 */
export class UnauthorizedPage {
  readonly page: Page;
  readonly codeHeading: Locator;
  readonly descriptionText: Locator;
  readonly homeLink: Locator;
  readonly logoImage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.codeHeading = page.locator('h1:has-text("403")');
    this.descriptionText = page.locator('text=Odmowa dostępu: Brak wystarczających uprawnień');
    this.homeLink = page.locator('a:has-text("Wróć na stronę główną")');
    this.logoImage = page.locator('img[alt="Silver Care"]');
  }

  async goto() {
    await this.page.goto('/unauthorized');
  }

  async expectAccessDenied() {
    await expect(this.codeHeading).toBeVisible();
    await expect(this.descriptionText).toBeVisible();
    await expect(this.homeLink).toBeVisible();
  }

  async clickHome() {
    await this.homeLink.click();
  }
}
