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

  readonly suspendMenuItem: Locator;
  readonly restoreMenuItem: Locator;
  readonly suspendDialogTitle: Locator;
  readonly restoreDialogTitle: Locator;
  readonly confirmationInput: Locator;
  readonly suspendConfirmButton: Locator;
  readonly restoreConfirmButton: Locator;
  readonly sendResetEmailButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.inviteStaffButton = page.locator('button:has-text("Zaproś pracownika")');
    this.roleSelect = page.locator('#role');
    this.emailInput = page.locator('#email');
    this.actionsTrigger = page.locator('button:has-text("Otwórz menu")').first();
    this.resetPasswordMenuItem = page.locator('[data-slot="dropdown-menu-item"]:has-text("Zresetuj hasło")');
    this.suspendMenuItem = page.locator('[data-slot="dropdown-menu-item"]:has-text("Zawieś konto")');
    this.restoreMenuItem = page.locator('[data-slot="dropdown-menu-item"]:has-text("Przywróć konto")');
    this.resetPasswordDialogTitle = page.locator('text=Reset Hasła Pracownika');
    this.suspendDialogTitle = page.locator('text=Zawieszenie Konta Pracownika');
    this.restoreDialogTitle = page.locator('text=Przywrócenie Konta Pracownika');
    this.confirmationInput = page.locator('#confirmation');
    this.suspendConfirmButton = page.locator('button:has-text("Zawieś konto")').last();
    this.restoreConfirmButton = page.locator('button:has-text("Przywróć konto")').last();
    this.sendResetEmailButton = page.locator('button:has-text("Wyślij e-mail z linkiem")');
  }

  async goto() {
    await this.page.goto('/admin/staff');
    await this.page.waitForLoadState('networkidle');
  }

  async openInviteDialog() {
    await this.inviteStaffButton.click();
    await expect(this.roleSelect).toBeVisible();
  }

  async openFirstStaffMenu() {
    await this.actionsTrigger.click();
    await expect(this.resetPasswordMenuItem).toBeVisible();
  }

  async openMenuForStaff(email: string) {
    const row = this.page.locator('tr', { hasText: email });
    await row.locator('button:has-text("Otwórz menu")').click();
    await expect(this.resetPasswordMenuItem).toBeVisible();
  }
}
