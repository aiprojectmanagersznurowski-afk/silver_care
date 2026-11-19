import { test, expect } from '../fixtures/base-test';

/**
 * @REQ: UI-TERMINOLOGY
 *
 * Tytuły i etykiety pisane zdaniowo (NFR-UI-06, CLAUDE.md: „Struktura placówki”), nie Title Case.
 * Asercje toHaveText i getByRole({ exact: true }) rozróżniają wielkość liter — w odróżnieniu od :has-text.
 */
test.describe('Pisownia zdaniowa tytułów (@REQ: UI-TERMINOLOGY)', () => {
  test('@REQ: UI-TERMINOLOGY - kierownik placówki: pulpit, dane dzienne i profil', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');

    await page.goto('/admin');
    await expect(page.locator('h1')).toHaveText('Pulpit główny');

    await page.goto('/admin/reports/daily');
    await expect(page.locator('h1')).toHaveText('Dane dzienne');

    await page.goto('/settings/profile');
    await expect(page.locator('h1')).toHaveText('Profil i bezpieczeństwo konta');
    await expect(page).toHaveTitle(/^Ustawienia profilu i bezpieczeństwa/);
    await expect(page.getByText('Zmiana hasła', { exact: true })).toBeVisible();
  });

  test('@REQ: UI-TERMINOLOGY - operator platformy: IAM, rejestr audytowy i status systemu', async ({ loginPage, page }) => {
    await loginPage.loginAs('super_admin');

    await page.goto('/admin/iam');
    await expect(page.locator('h1')).toHaveText('Zarządzanie dostępem i tożsamością (IAM)');
    await expect(page.getByText('Dziennik audytowy zmian uprawnień', { exact: true })).toBeVisible();
    await expect(page.getByText('Użytkownicy i role', { exact: true })).toBeVisible();

    await page.goto('/admin/audit');
    await expect(page.locator('h1')).toHaveText('Rejestr audytowy');
    await expect(page.getByText('Zdarzenia audytowe', { exact: true })).toBeVisible();

    await page.goto('/admin/system-status');
    await expect(page.getByRole('heading', { name: 'Status systemu i alerty', exact: true })).toBeVisible();
  });

  test('@REQ: UI-TERMINOLOGY - portal rodziny: nawigacja „Plan dnia”', async ({ loginPage, familyDashboardPage, page }) => {
    await loginPage.loginAs('family');
    await expect(page).toHaveURL(/\/dashboard$/);
    // Modal powitalny (aria-modal) wyłącza resztę strony z drzewa dostępności.
    await familyDashboardPage.dismissOnboardingModalIfExists();
    await expect(page.getByRole('link', { name: 'Plan dnia', exact: true }).first()).toBeAttached();
  });
});
