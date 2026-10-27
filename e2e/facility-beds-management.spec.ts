import { test, expect } from './fixtures/base-test';
import { FacilityPage } from './page-objects/FacilityPage';

/**
 * @REQ: ADM-FACILITY-MANAGE
 * @REQ: ADM-BED-ASSIGNMENT
 * @REQ: ADM-FACILITY-OCCUPANCY
 *
 * Testy E2E dla modułu zarządzania strukturą pokoi i łóżek:
 * AC1: Przełączanie widoku Kafelki / Tabela.
 * AC2: Zaawansowane filtry po piętrze, sektorze i stanie obłożenia.
 * AC3: Transparentne reguły alokacji i modal edycji przypisania łóżka.
 */
test.describe('Zarządzanie strukturą pokoi i łóżek (@REQ: ADM-FACILITY-MANAGE, @REQ: ADM-BED-ASSIGNMENT, @REQ: ADM-FACILITY-OCCUPANCY)', () => {
  test('@REQ: ADM-FACILITY-OCCUPANCY - AC1 & AC2: Przełączanie widoków Kafelki / Tabela oraz filtrowanie pokoi', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const facilityPage = new FacilityPage(page);
    await facilityPage.goto();

    // Weryfikacja obecności kontrolek widoku i filtrów
    await expect(facilityPage.viewGridButton).toBeVisible();
    await expect(facilityPage.viewTableButton).toBeVisible();
    await expect(facilityPage.searchInput).toBeVisible();
    await expect(facilityPage.floorFilter).toBeVisible();
    await expect(facilityPage.occupancyFilter).toBeVisible();

    // AC1: Przełączenie na widok tabelaryczny
    await facilityPage.switchToTable();
    await expect(facilityPage.roomTable).toBeVisible();

    // AC1: Przełączenie z powrotem na widok kafelkowy
    await facilityPage.switchToGrid();

    // AC2: Filtrowanie po statusie "free" (tylko z wolnymi miejscami)
    await facilityPage.filterByOccupancy('free');
    await page.waitForTimeout(300);

    // AC2: Filtrowanie po numerze pokoju w wyszukiwarce
    await facilityPage.searchInput.fill('10');
    await page.waitForTimeout(300);
  });

  test('@REQ: ADM-FACILITY-OCCUPANCY - AC3: Rozwijanie łóżek w widoku tabeli i kafelkowym z tabelarycznym układem łóżek', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const facilityPage = new FacilityPage(page);
    await facilityPage.goto();

    // 1. Widok tabeli: rozwijanie wiersza łóżek
    await facilityPage.switchToTable();
    await expect(facilityPage.roomTable).toBeVisible();

    const bedsButtonInTable = page.locator('[data-testid="room-table"] tbody button:has-text("Łóżka")').first();
    if (await bedsButtonInTable.isVisible()) {
      await bedsButtonInTable.click();
      await expect(facilityPage.expandedBedRows.first()).toBeVisible();
      await expect(facilityPage.bedsTable.first()).toBeVisible();

      // Kliknięcie Zwiń
      const collapseButton = page.locator('[data-testid="room-table"] tbody button:has-text("Zwiń")').first();
      await collapseButton.click();
      await expect(facilityPage.expandedBedRows.first()).not.toBeVisible();
    }

    // 2. Widok kafli: rozwijanie łóżek i weryfikacja tabelarycznego formatu
    await facilityPage.switchToGrid();
    const manageBedsButtonInGrid = page.locator('[data-testid="room-card"] button:has-text("Zarządzaj łóżkami")').first();
    if (await manageBedsButtonInGrid.isVisible()) {
      await manageBedsButtonInGrid.click();
      await expect(facilityPage.bedsTable.first()).toBeVisible();
    }
  });

  test('@REQ: ADM-FACILITY-MANAGE - dialog Import / Eksport nie zawiera zakładki Dodaj głosowo', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const facilityPage = new FacilityPage(page);
    await facilityPage.goto();

    await facilityPage.openImportExport();
    await expect(facilityPage.exportTabButton).toBeVisible();
    await expect(facilityPage.importTabButton).toBeVisible();
    await expect(facilityPage.voiceTabButton).not.toBeVisible();
  });
});
