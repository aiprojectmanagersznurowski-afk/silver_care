import { Page, Locator, expect } from '@playwright/test';

/**
 * @REQ: ORG-PROVISION
 * @REQ: ORG-ISOLATION
 *
 * Page Object dla widoku Zarządzania Placówkami (/admin/organizations).
 */
export class OrganizationManagementPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly tableViewBtn: Locator;
  readonly cardsViewBtn: Locator;
  readonly table: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator(':is(h1, h2):has-text("Zarządzanie Placówkami")');
    this.tableViewBtn = page.locator('button[aria-label="Widok tabeli"], button:has-text("Tabela")');
    this.cardsViewBtn = page.locator('button[aria-label="Widok kafelków"], button:has-text("Kafelki")');
    this.table = page.locator('table');
  }

  /** Wiersz tabeli placówki o podanej nazwie. */
  rowFor(organizationName: string): Locator {
    return this.table.getByRole('row').filter({ hasText: organizationName });
  }

  async goto() {
    await this.page.goto('/admin/organizations');
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }

  async switchToTable() {
    await this.tableViewBtn.click();
    await expect(this.table).toBeVisible();
  }

  async switchToCards() {
    await this.cardsViewBtn.click();
    await expect(this.table).not.toBeVisible();
  }

  async expectTableHeaders() {
    await expect(this.table.locator('th:has-text("Nazwa")')).toBeVisible();
    await expect(this.table.locator('th:has-text("Adres")')).toBeVisible();
    await expect(this.table.locator('th:has-text("Limit")')).toBeVisible();
    await expect(this.table.locator('th:has-text("Akcje")')).toBeVisible();
  }

  async openEditDialog() {
    await this.table.locator('[data-slot="row-actions"]').first().click();
    await this.page.getByRole('menuitem', { name: 'Edytuj' }).click();
    await expect(this.page.locator('div[role="dialog"]')).toBeVisible();
  }
}
