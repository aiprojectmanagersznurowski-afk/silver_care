import { test, expect } from './fixtures/base-test';

/**
 * @REQ: SEC-SESSION
 * @REQ: SEC-MFA-STAFF
 *
 * Testy E2E dla uwierzytelniania, zarządzania sesją i ochrony tras.
 */

test.describe('Autentykacja i ochrona tras', () => {
  test('@REQ: SEC-SESSION - Niezalogowany użytkownik próbujący wejść na /admin zostaje przekierowany', async ({ page }) => {
    await page.goto('/admin');
    // Middleware przekierowuje niezalogowanego użytkownika na /
    await expect(page).toHaveURL(/\/(login)?$/);
  });

  test('@REQ: SEC-SESSION - Formularz logowania wyświetla błąd przy niepoprawnych danych', async ({ loginPage, authHelper }) => {
    // Mockujemy odpowiedź Supabase Auth dla nieprawidłowego hasła
    await authHelper.mockSignInResponse({
      success: false,
      errorMessage: 'Nieprawidłowy email lub hasło.',
    });

    await loginPage.goto();
    await loginPage.login('nieistniejacy@example.com', 'zleHaslo123!');
    await loginPage.expectErrorMessage('Nieprawidłowy email lub hasło.');
  });

  test('@REQ: SEC-MFA-STAFF - Dostęp do strony 403 /unauthorized zawiera czytelny komunikat i link powrotny', async ({ unauthorizedPage, page }) => {
    await unauthorizedPage.goto();
    await unauthorizedPage.expectAccessDenied();
    await unauthorizedPage.clickHome();
    await expect(page).toHaveURL(/\/(login)?$/);
  });
});
