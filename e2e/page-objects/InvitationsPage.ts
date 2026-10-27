import { Page, Locator } from '@playwright/test';

/**
 * Page Object listy zaproszeń bliskich (/admin/invitations).
 * @REQ: ADM-INVITE
 */
export class InvitationsPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/admin/invitations');
    await this.page.waitForLoadState('networkidle');
  }

  columnHeader(name: string): Locator {
    return this.page.locator('main [data-slot="table-header"]').getByRole('columnheader', { name });
  }

  /** Adresy e-mail w kolejności wierszy tabeli. */
  async emails(): Promise<string[]> {
    const cells = await this.page.locator('main [data-slot="table-body"] [data-testid="invitation-email"]').allInnerTexts();
    return cells.map((c) => c.trim());
  }
}
