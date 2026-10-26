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
  readonly header: Locator;
  readonly accountTrigger: Locator;
  readonly accountRoleLabel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('[data-slot="sidebar"][data-state]');
    this.trigger = page.locator('[data-slot="sidebar-trigger"]');
    this.inset = page.locator('[data-slot="sidebar-inset"]');
    this.header = page.locator('[data-slot="app-header"]');
    this.accountTrigger = page.locator('[data-slot="sidebar"] [data-slot="nav-user-trigger"]');
    this.accountRoleLabel = this.accountTrigger.locator('[data-slot="nav-user-role"]');
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

  /** Układ nagłówka szablonu: start (zwijanie, separator, wyszukiwarka) i koniec (akcje, motyw). */
  async headerLayout() {
    return this.header.evaluate((h) => {
      const start = h.querySelector('[data-slot="app-header-start"]');
      const end = h.querySelector('[data-slot="app-header-end"]');
      return {
        height: Math.round(h.getBoundingClientRect().height),
        startHasTrigger: !!start?.querySelector('[data-slot="sidebar-trigger"]'),
        startHasSearch: !!start?.querySelector('button[aria-label="Wyszukaj w systemie"]'),
        endHasTheme: !!end?.querySelector('[data-slot="theme-toggle"]'),
      };
    });
  }

  /** Otwiera rozwijane menu konta w stopce paska bocznego (nav-user szablonu). */
  async openAccountMenu() {
    // Na telefonie pasek boczny jest zamkniętą szufladą — najpierw ją otwieramy
    if (!(await this.accountTrigger.isVisible())) await this.trigger.first().click();
    await this.accountTrigger.click();
    const menu = this.page.locator('[role="menu"]');
    await expect(menu).toBeVisible();
    return menu;
  }

  async toggle() {
    await this.trigger.click();
  }
}
