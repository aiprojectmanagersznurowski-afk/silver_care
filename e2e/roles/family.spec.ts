import { test, expect } from '../fixtures/base-test';

/**
 * @REQ: FAM-DASHBOARD
 * @REQ: FAM-AGENDA
 * @REQ: FAM-MESSAGES
 * @REQ: MDR-NO-PHYSIO-TO-FAMILY
 *
 * Testy UI dla roli Family (Członek Rodziny / Bliski).
 */

test.describe('Rola: Członek Rodziny (Portal Bliskich)', () => {
  test('@REQ: FAM-DASHBOARD - Członek rodziny loguje się, sprawdza pulpit, plan dnia i wiadomości', async ({ loginPage, familyDashboardPage, page }) => {
    await loginPage.loginAs('family');

    // Rodzina trafia bezpośrednio do portalu bliskich
    await expect(page).toHaveURL(/\/dashboard$/);

    // Zamknięcie powitalnego modala informacyjnego
    await familyDashboardPage.dismissOnboardingModalIfExists();

    // Sprawdzenie zgodności z granicą MDR: brak wskaźników fizjologicznych na pulpicie
    await familyDashboardPage.expectMdrCompliant();

    // Przejście do planu dnia podopiecznego
    await familyDashboardPage.navigateToAgenda();
    await expect(page).toHaveURL(/\/agenda/);
    await expect(page.locator('h2:has-text("Plan Dnia")')).toBeVisible();

    // Przejście do wiadomości z personelem
    await familyDashboardPage.navigateToMessages();
    await expect(page).toHaveURL(/\/messages/);
    await expect(page.locator('h2:has-text("Wiadomości")')).toBeVisible();

    // Wylogowanie
    await familyDashboardPage.logout();
    await expect(page).toHaveURL(/\/login/);
  });

  test('@REQ: MDR-NO-PHYSIO-TO-FAMILY - Rodzina ma zablokowany dostęp do stref personelu (/staff) i administracji (/admin)', async ({ loginPage, page }) => {
    await loginPage.loginAs('family');

    // Próba wejścia do panelu personelu
    await page.goto('/staff');
    await expect(page).toHaveURL(/\/unauthorized/);
    await expect(page.locator('text=403')).toBeVisible();

    // Próba wejścia do panelu administratora
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/unauthorized/);
    await expect(page.locator('text=403')).toBeVisible();
  });
});
