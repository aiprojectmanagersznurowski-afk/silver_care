import { test, expect } from './fixtures/base-test';

/**
 * @REQ: FAM-DASHBOARD
 * @REQ: UI-FOUR-STATES
 *
 * Testy E2E dla Portalu Bliskich (widoki, ochrona dostępu, stany interfejsu).
 */

test.describe('Portal Bliskich (Family Portal)', () => {
  test('@REQ: FAM-DASHBOARD - Niezalogowany użytkownik próbujący wejść na /dashboard trafia na stronę główną/logowanie', async ({ page }) => {
    await page.goto('/dashboard');
    // Middleware zabezpiecza trasę rodziny przed nieautoryzowanym dostępem
    await expect(page).toHaveURL(/\/(login)?$/);
  });

  test('@REQ: UI-FOUR-STATES - Strona główna i logowanie prezentują kompletny stan wizualny bez błędów konsoli', async ({ page, loginPage }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await loginPage.goto();
    await loginPage.expectLoaded();

    // Sprawdzenie, że brak krytycznych błędów skryptów w konsoli
    const criticalErrors = consoleErrors.filter((err) => !err.includes('favicon'));
    expect(criticalErrors).toHaveLength(0);
  });
});
