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
    this.heading = page.locator('h2:has-text("Zarządzanie Placówkami")');
    this.tableViewBtn = page.locator('button[aria-label="Widok tabeli"], button:has-text("Tabela")');
    this.cardsViewBtn = page.locator('button[aria-label="Widok kafelków"], button:has-text("Kafelki")');
    this.table = page.locator('table');
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
    const editBtn = this.page.locator('button:has-text("Edytuj")').first();
    await editBtn.click();
    await expect(this.page.locator('div[role="dialog"]')).toBeVisible();
  }
}
