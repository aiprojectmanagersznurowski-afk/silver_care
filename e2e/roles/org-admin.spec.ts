import { test, expect } from '../fixtures/base-test';

/**
 * @REQ: ADM-FACILITY-OCCUPANCY
 * @REQ: ADM-FACILITY-MANAGE
 * @REQ: ADM-RESIDENT-ADD
 *
 * Testy UI dla roli Org Admin (Administrator Placówki).
 */

test.describe('Rola: Org Admin (Administrator Placówki)', () => {
  test('@REQ: ADM-FACILITY-OCCUPANCY - Org Admin loguje się i widzi KPI placówki oraz strukturę pokoi', async ({ loginPage, adminDashboardPage, page }) => {
    await loginPage.loginAs('org_admin');

    // Org Admin trafia na pulpit placówki
    await expect(page).toHaveURL(/\/admin$/);
    await adminDashboardPage.expectDashboardLoaded();

    // Przejście do struktury placówki (pokoje i łóżka)
    await adminDashboardPage.navigateToFacility();
    await expect(page).toHaveURL(/\/admin\/facility/);
    await expect(page.locator('h2:has-text("Struktura Placówki")')).toBeVisible();

    // Przejście do rejestru podopiecznych
    await adminDashboardPage.navigateToResidents();
    await expect(page).toHaveURL(/\/admin\/residents/);
    await expect(page.locator('h2:has-text("Podopieczni")')).toBeVisible();

    // Przejście do listy personelu
    await adminDashboardPage.navigateToStaff();
    await expect(page).toHaveURL(/\/admin\/staff/);
    await expect(page.locator('h2:has-text("Personel")')).toBeVisible();

    // Wylogowanie
    await adminDashboardPage.logout();
    await expect(page).toHaveURL(/\/login/);
  });

  test('@REQ: ADM-FACILITY-MANAGE - Org Admin ma zablokowany dostęp do modułu globalnego Super Admina (IAM)', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');

    // Org Admin nie widzi linku do IAM w menu bocznym
    await expect(page.locator('a[href="/admin/iam"]')).toBeHidden();

    // Próba wejścia na ścieżkę zarezerwowaną dla Super Admina przekierowuje na /admin
    await page.goto('/admin/iam');
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator('h2:has-text("Zarządzanie Dostępem i Tożsamością (IAM)")')).toBeHidden();
  });
});

