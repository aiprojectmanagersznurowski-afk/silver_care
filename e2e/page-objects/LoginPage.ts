import { Page, Locator, expect } from '@playwright/test';
import { TEST_USERS, E2E_PASSWORD, TestRole } from '../fixtures/test-users';

export { TestRole };

/**
 * Page Object dla strony logowania (/login).
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly cardTitle: Locator;
  readonly cardDescription: Locator;
  readonly errorAlert: Locator;
  readonly googleLoginButton: Locator;
  readonly logoImage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.locator('button[type="submit"]');
    this.cardTitle = page.locator('text=Zaloguj się');
    this.cardDescription = page.locator('text=Wprowadź swoje dane, aby uzyskać dostęp do panelu.');
    this.errorAlert = page.locator('.text-destructive');
    this.googleLoginButton = page.locator('button:has-text("Zaloguj z Google")');
    this.logoImage = page.locator('img[alt="Silver Care"]');
  }

  async goto() {
    await this.page.goto('/login');
    // Strona posiada animację (1100ms) odsłaniającą formularz lub kliknięcie w tło
    await this.page.waitForLoadState('domcontentloaded');
  }

  async revealForm() {
    // Czekamy aż pole email stanie się widoczne lub klikamy w tło, aby przyspieszyć animację
    try {
      await this.emailInput.waitFor({ state: 'visible', timeout: 2000 });
    } catch {
      await this.page.locator('body').click();
      await this.emailInput.waitFor({ state: 'visible', timeout: 3000 });
    }
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async fillPassword(pass: string) {
    await this.passwordInput.fill(pass);
  }

  async submit() {
    await this.submitButton.click();
  }

  async login(email: string, pass: string) {
    await this.revealForm();
    await this.fillEmail(email);
    await this.fillPassword(pass);
    await this.submit();
  }

  /**
   * Loguje się jako użytkownik o zadanej roli za pomocą przygotowanych kont E2E.
   */
  async loginAs(role: TestRole) {
    const user = TEST_USERS[role];
    if (!user) throw new Error(`Nieznana rola testowa: ${role}`);
    await this.goto();
    await this.login(user.email, E2E_PASSWORD);
    await this.page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
  }

  async expectErrorMessage(message: string) {
    await expect(this.errorAlert).toBeVisible();
    await expect(this.errorAlert).toContainText(message);
  }

  async expectLoaded() {
    await expect(this.logoImage.first()).toBeVisible();
  }
}
