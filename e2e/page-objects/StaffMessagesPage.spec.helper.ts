import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla Skrzynki Wiadomości Personelu (/staff/messages).
 * @REQ: FAM-MESSAGES
 * @REQ: NUR-BOARD
 */
export class StaffMessagesPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly threadsList: Locator;
  readonly emptyState: Locator;
  readonly conversationHeader: Locator;
  readonly messagesContainer: Locator;
  readonly replyTextarea: Locator;
  readonly sendButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.locator('input[placeholder*="Szukaj"]');
    this.threadsList = page.locator('[data-testid="message-threads-list"]');
    this.emptyState = page.locator('[data-testid="messages-empty-state"]');
    this.conversationHeader = page.locator('[data-testid="conversation-header"]');
    this.messagesContainer = page.locator('[data-testid="messages-scroll-container"]');
    this.replyTextarea = page.locator('textarea[placeholder*="odpowiedź"], textarea[placeholder*="Wpisz"]');
    this.sendButton = page.locator('button:has-text("Wyślij")');
  }

  async goto(residentId?: string) {
    const url = residentId ? `/staff/messages?residentId=${residentId}` : '/staff/messages';
    await this.page.goto(url);
  }

  async expectPageLoaded() {
    await expect(this.page.locator('h1, h2').filter({ hasText: /Wiadomości/i })).toBeVisible();
  }

  async selectThread(residentName: string) {
    const threadItem = this.page.locator(`[data-testid="thread-item"]:has-text("${residentName}")`);
    await threadItem.click();
    await expect(this.conversationHeader).toBeVisible();
  }

  async sendReply(content: string) {
    await this.replyTextarea.fill(content);
    await this.sendButton.click();
  }
}
