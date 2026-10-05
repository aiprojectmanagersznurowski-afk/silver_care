import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object powłoki aplikacji z szablonu shadcn-admin: zwijany pasek boczny
 * i nagłówek z przyciskiem zwijania (panel administratora i personelu).
 * @REQ: UI-TEMPLATE-ALIGNMENT
 */
export class AppShellPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly trigger: Locator;
  readonly inset: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('[data-slot="sidebar"][data-state]');
    this.trigger = page.locator('[data-slot="sidebar-trigger"]');
    this.inset = page.locator('[data-slot="sidebar-inset"]');
  }

  navLink(href: string): Locator {
    return this.sidebar.locator(`a[href="${href}"]`);
  }

  async expectExpanded() {
    await expect(this.sidebar).toHaveAttribute('data-state', 'expanded');
  }

  async expectCollapsed() {
    await expect(this.sidebar).toHaveAttribute('data-state', 'collapsed');
    await expect(this.sidebar).toHaveAttribute('data-collapsible', 'icon');
  }

  async toggle() {
    await this.trigger.click();
  }
}
