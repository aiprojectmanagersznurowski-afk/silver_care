import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla strony akceptacji zaproszenia (/accept-invite).
 */
export class AcceptInvitePage {
  readonly page: Page;
  readonly cardTitle: Locator;
  readonly cardDescription: Locator;
  readonly acceptButton: Locator;
  readonly emptyTitle: Locator;
  readonly errorTitle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cardTitle = page.locator('text=Zaproszenie do placówki');
    this.cardDescription = page.locator('text=Zostałeś zaproszony do dołączenia do systemu Silver Care.');
    this.acceptButton = page.locator('button:has-text("Akceptuj zaproszenie")');
    this.emptyTitle = page.locator('text=Brak aktywnego zaproszenia');
    this.errorTitle = page.locator('text=Nieprawidłowe zaproszenie');
  }

  async goto(urlParam?: string) {
    const path = urlParam ? `/accept-invite?url=${encodeURIComponent(urlParam)}` : '/accept-invite';
    await this.page.goto(path);
  }

  async gotoToken(token: string) {
    await this.page.goto(`/accept-invite?token=${encodeURIComponent(token)}`);
  }

  async expectInviteCard() {
    await expect(this.cardTitle).toBeVisible();
    await expect(this.cardDescription).toBeVisible();
    await expect(this.acceptButton).toBeVisible();
  }

  async expectEmptyState() {
    await expect(this.emptyTitle).toBeVisible();
  }

  async expectErrorState() {
    await expect(this.errorTitle).toBeVisible();
  }

  async clickAccept() {
    await this.acceptButton.click();
  }
}
