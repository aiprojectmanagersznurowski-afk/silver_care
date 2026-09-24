import { test, expect } from '../fixtures/base-test';

/**
 * @REQ: NUR-BOARD
 * @REQ: NUR-AGENDA
 * @REQ: REPORT-APPROVAL
 *
 * Testy UI dla roli Nurse (Pielęgniarka / Pielęgniarz / Personel Opiekuńczy).
 */

test.describe('Rola: Personel Opiekuńczy (Pielęgniarka / Pielęgniarz)', () => {
  test('@REQ: NUR-BOARD - Personel loguje się, zarządza widokami obchodu i filtruje podopiecznych', async ({ loginPage, staffBoardPage, page }) => {
    await loginPage.loginAs('nurse');

    // Personel trafia bezpośrednio na tablicę podopiecznych
    await expect(page).toHaveURL(/\/staff$/);
    await staffBoardPage.expectStaffBoardLoaded();

    // Przełączenie widoku na Szybki obchód
    await staffBoardPage.switchToRounds();

    // Powrót do widoku Kart
    await staffBoardPage.switchToCards();

    // Wyszukiwanie podopiecznego
    await staffBoardPage.searchResident('Jan');

    // Przejście do planu dnia personelu
    await staffBoardPage.navigateToAgenda();
    await expect(page).toHaveURL(/\/staff\/agenda/);
    await expect(page.locator('h2:has-text("Plan Dnia")')).toBeVisible();

    // Przejście do modułu raportów opieki
    await staffBoardPage.navigateToReports();
    await expect(page).toHaveURL(/\/staff\/reports/);
    await expect(page.locator('h2:has-text("Raporty")')).toBeVisible();

    // Wylogowanie
    await staffBoardPage.logout();
    await expect(page).toHaveURL(/\/login/);
  });

  test('@REQ: REPORT-APPROVAL - Personel ma zablokowany dostęp do modułów administracyjnych placówki (/admin)', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');

    // Próba wejścia do panelu administracyjnego
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/unauthorized/);
    await expect(page.locator('text=403')).toBeVisible();
  });
});
