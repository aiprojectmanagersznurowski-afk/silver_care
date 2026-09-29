import { test, expect } from '../fixtures/base-test';
import { OrganizationManagementPage } from '../page-objects/OrganizationManagementPage.spec.helper';

/**
 * @REQ: ORG-PROVISION
 * @REQ: ORG-ISOLATION
 *
 * Testy E2E dla zarządzania placówkami (ORG-FACILITY-MANAGEMENT):
 * AC1: Przełącznik widoków (Kafelki / Tabela)
 * AC2: Widok tabelaryczny z kompletem metryk
 * AC3: Dostępność opcji edycji placówki
 */
test.describe('Zarządzanie Placówkami dla Super Admina (@REQ: ORG-PROVISION)', () => {
  test('@REQ: ORG-PROVISION - AC1 & AC2: Przełączanie widoków Kafelki / Tabela oraz weryfikacja tabeli', async ({ loginPage, page }) => {
    const orgPage = new OrganizationManagementPage(page);

    await loginPage.loginAs('super_admin');
    await orgPage.goto();
    await orgPage.expectLoaded();

    // Weryfikacja obecności przełącznika widoków
    await expect(orgPage.cardsViewBtn).toBeVisible();
    await expect(orgPage.tableViewBtn).toBeVisible();

    // AC1: Przełączenie na widok tabeli
    await orgPage.switchToTable();
    await orgPage.expectTableHeaders();

    // AC2: Przełączenie z powrotem na kafelki
    await orgPage.switchToCards();
  });
});
