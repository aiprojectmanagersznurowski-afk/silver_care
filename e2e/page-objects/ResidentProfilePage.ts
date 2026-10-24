import { Page, Locator } from '@playwright/test';

/**
 * Page Object profilu podopiecznego w układzie szablonu (nagłówek, zakładki, pasek boczny).
 * @REQ: UI-TEMPLATE-ALIGNMENT
 */
export class ResidentProfilePage {
  readonly tablist: Locator;
  readonly sidebar: Locator;

  constructor(private readonly page: Page) {
    this.tablist = page.locator('main [role="tablist"]:visible').first();
    this.sidebar = page.locator('main [data-slot="profile-sidebar"]:visible');
  }

  /** Otwiera profil pierwszego podopiecznego z listy. */
  async openFirstFromList() {
    await this.page.goto('/admin/residents');
    await this.page.locator('main table tbody tr a').first().click();
    await this.page.waitForURL(/\/admin\/residents\/[a-f0-9-]+/);
    await this.page.waitForLoadState('networkidle');
  }

  tab(name: string): Locator {
    return this.tablist.getByRole('tab', { name });
  }

  async tabNames(): Promise<string[]> {
    return this.tablist.getByRole('tab').allInnerTexts();
  }

  visibleCardTitles(): Promise<string[]> {
    return this.page.locator('main [data-slot="card-title"]:visible').allInnerTexts();
  }
}
