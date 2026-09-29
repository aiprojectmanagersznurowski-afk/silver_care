import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla Panelu Zarządzania Uprawnieniami i Tożsamością (IAM) (/admin/iam).
 * Odpowiada za testowanie wymagań SUP-IAM-PANEL oraz SEC-IAM-HARDENING.
 */
export class IamPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly usersTable: Locator;
  readonly resetPasswordModal: Locator;
  readonly resetPasswordTitle: Locator;
  readonly sendResetLinkButton: Locator;
  readonly cancelResetButton: Locator;
  readonly passwordInputField: Locator;
  readonly addUserButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h2:has-text("Zarządzanie Dostępem i Tożsamością (IAM)")');
    this.usersTable = page.locator('table[aria-label="Tabela użytkowników i ról IAM"]');
    this.resetPasswordModal = page.locator('[role="dialog"]');
    this.resetPasswordTitle = page.locator('text=Resetuj hasło użytkownika');
    this.sendResetLinkButton = page.locator('button:has-text("Wyślij link resetujący")');
    this.cancelResetButton = page.locator('button:has-text("Anuluj")');
    this.passwordInputField = page.locator('#reset-new-password');
    this.addUserButton = page.locator('button:has-text("Dodaj użytkownika")');
  }

  async goto() {
    await this.page.goto('/admin/iam');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.usersTable).toBeVisible();
  }

  async openResetPasswordForUser(email: string) {
    const row = this.page.locator('tbody tr', { hasText: email });
    await expect(row).toBeVisible();
    const resetBtn = row.locator('button:has-text("Hasło")');
    await resetBtn.click();
    await expect(this.resetPasswordTitle).toBeVisible();
  }

  async expectNoManualPasswordField() {
    // Zgodnie z AC1 SEC-IAM-HARDENING pole wprowadzania hasła nie może istnieć
    await expect(this.passwordInputField).toHaveCount(0);
  }

  async expectRecoveryLinkNotice() {
    await expect(this.page.locator('text=zostanie wygenerowany i przesłany bezpieczny link do zresetowania hasła, text=Wyślij link')).toBeVisible();
  }

  async getRoleOptionsForUser(email: string): Promise<string[]> {
    const row = this.page.locator('tbody tr', { hasText: email });
    const select = row.locator('select');
    return await select.locator('option').allTextContents();
  }

  async expectRoleOptionsExcludeSuperAdmin(email: string) {
    const options = await this.getRoleOptionsForUser(email);
    for (const opt of options) {
      expect(opt.toLowerCase()).not.toContain('super admin');
      expect(opt.toLowerCase()).not.toContain('super_admin');
    }
  }
}
