import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla Panelu Zarządzania Personelem (/admin/staff).
 * @REQ: ADM-INVITE
 * @REQ: ORG-ISOLATION
 */
export class StaffPage {
  readonly page: Page;
  readonly inviteStaffButton: Locator;
  readonly roleSelect: Locator;
  readonly emailInput: Locator;
  readonly actionsTrigger: Locator;
  readonly resetPasswordMenuItem: Locator;
  readonly resetPasswordDialogTitle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.inviteStaffButton = page.locator('button:has-text("Zaproś pracownika")');
    this.roleSelect = page.locator('#role');
    this.emailInput = page.locator('#email');
    this.actionsTrigger = page.locator('button:has-text("Otwórz menu"), button:has([data-slot="dropdown-menu-trigger"])').first();
    this.resetPasswordMenuItem = page.locator('[data-slot="dropdown-menu-item"]:has-text("Zresetuj hasło")');
    this.resetPasswordDialogTitle = page.locator('text=Reset Hasła Pracownika');
  }

  async goto() {
    await this.page.goto('/admin/staff');
    await this.page.waitForLoadState('networkidle');
  }

  async openInviteDialog() {
    await this.inviteStaffButton.click();
    await expect(this.roleSelect).toBeVisible();
  }
}
