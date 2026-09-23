import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla strony akceptacji zaproszenia (/accept-invite).
 */
export class AcceptInvitePage {
  readonly page: Page;
  readonly cardTitle: Locator;
  readonly cardDescription: Locator;
  readonly acceptButton: Locator;
  readonly logoImage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cardTitle = page.locator('text=Zaproszenie do placówki');
    this.cardDescription = page.locator('text=Zostałeś zaproszony do dołączenia do systemu Silver Care.');
    this.acceptButton = page.locator('button:has-text("Akceptuj zaproszenie")');
    this.logoImage = page.locator('img[alt="Silver Care"]');
  }

  async goto(urlParam?: string) {
    const path = urlParam ? `/accept-invite?url=${encodeURIComponent(urlParam)}` : '/accept-invite';
    await this.page.goto(path);
  }

  async expectInviteCard() {
    await expect(this.cardTitle).toBeVisible();
    await expect(this.cardDescription).toBeVisible();
    await expect(this.acceptButton).toBeVisible();
  }

  async clickAccept() {
    await this.acceptButton.click();
  }
}
