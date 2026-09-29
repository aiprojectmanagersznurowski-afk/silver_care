import { test, expect } from '../fixtures/base-test';

/**
 * @REQ: FAM-DASHBOARD
 * @REQ: MDR-NO-PHYSIO-TO-FAMILY
 *
 * Testy E2E dla pulpitu rodziny (FAM-DASHBOARD-OVERHAUL):
 * AC1: Sprawne menu profilu i wylogowanie bez rzucania błędów w konsoli
 * AC2: Podsumowanie dnia widoczne na samej górze pulpitu
 * AC3: Nawigacja datami (poprzedni dzień / następny dzień / selektor)
 */
test.describe('Pulpit Rodziny — Overhaul i Poprawka Menu Profilu (@REQ: FAM-DASHBOARD)', () => {
  test('@REQ: FAM-DASHBOARD - AC1: Menu profilu w nagłówku otwiera się płynnie i umożliwia wylogowanie', async ({ loginPage, familyDashboardPage, page }) => {
    // Monitorowanie błędów konsoli przeglądarki
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await loginPage.loginAs('family');
    await familyDashboardPage.goto();
    await familyDashboardPage.dismissOnboardingModalIfExists();

    // AC1: Kliknięcie w menu konta w prawym górnym rogu
    const accountTrigger = page.locator('header button:has-text("Wyświetlany profil"), header button:has-text("Konto")');
    await expect(accountTrigger).toBeVisible();
    await accountTrigger.click();

    // Weryfikacja braku krytycznego błędu React/Radix
    const logoutBtn = page.locator('[role="menu"] button:has-text("Wyloguj się"), [role="menuitem"]:has-text("Wyloguj się")');
    await expect(logoutBtn).toBeVisible();
    expect(errors.filter(e => e.includes('render is not a function') || e.includes('Element type is invalid'))).toHaveLength(0);
  });

  test('@REQ: FAM-DASHBOARD - AC2 & AC3: Podsumowanie dnia jest na szczycie pulpitu z paskiem nawigacji po dacie', async ({ loginPage, familyDashboardPage, page }) => {
    await loginPage.loginAs('family');
    await familyDashboardPage.goto();
    await familyDashboardPage.dismissOnboardingModalIfExists();

    // AC2: Karta podsumowania dnia (DailySummaryHero) widoczna na szczycie
    const dailyHero = page.locator('h2:has-text("Podsumowanie Dnia")');
    await expect(dailyHero).toBeVisible();

    // AC3: Pasek nawigacji datami
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();

    // RODO / MDR weryfikacja
    await familyDashboardPage.expectMdrCompliant();
  });
});
