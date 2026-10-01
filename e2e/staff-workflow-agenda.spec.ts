import { test, expect } from './fixtures/base-test';
import { StaffAgendaPage } from './page-objects/StaffAgendaPage.spec.helper';

/**
 * @REQ: NUR-BOARD
 * @REQ: NUR-AGENDA
 *
 * Testy E2E dla panelu personelu i agendy (NUR-STAFF-WORKFLOW-AGENDA):
 * AC1: Szybki obchód na górze z filtrami tokenowymi.
 * AC2: Dedykowana pozycja 'Agenda na dziś' w menu bocznym.
 * AC3: Planer dnia z podziałem na pory dnia i przypisywaniem zadań do podopiecznych.
 */
test.describe('Panel personelu i Agenda na dziś (@REQ: NUR-BOARD, @REQ: NUR-AGENDA)', () => {
  test('@REQ: NUR-BOARD - Panel personelu eksponuje szybki obchód oraz filtry tokenowe', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    await page.goto('/staff');
    await page.waitForLoadState('networkidle');

    // Sprawdzenie obecności paska filtrów tokenowych
    const tokenBar = page.locator('[data-testid="filter-token-bar"]');
    await expect(tokenBar).toBeVisible();

    // Sprawdzenie tokenów statusu
    const statusTokens = tokenBar.locator('[data-filter-group="status"] button');
    await expect(statusTokens.first()).toBeVisible();

    // Sprawdzenie przycisków szybkiego obchodu (1-klik)
    const quickLogButtons = page.locator('button:has-text("Stan stabilny"), button:has-text("Stabilny")');
    await expect(quickLogButtons.first()).toBeVisible();
  });

  test('@REQ: NUR-AGENDA - Menu personelu zawiera dedykowany link "Agenda na dziś"', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    await page.goto('/staff');
    await page.waitForLoadState('networkidle');

    // Weryfikacja menu bocznego
    const agendaMenuItem = page.locator('nav a[href="/staff/agenda"]:has-text("Agenda na dziś")');
    await expect(agendaMenuItem).toBeVisible();

    // Kliknięcie i przejście do agendy
    await agendaMenuItem.click();
    await page.waitForURL('**/staff/agenda');
    await expect(page.locator('h2')).toContainText('Agenda');
  });

  test('@REQ: NUR-AGENDA - Planer dnia zawiera sekcje pór dnia oraz wybór podopiecznego w formularzu', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    const agendaPage = new StaffAgendaPage(page);
    await agendaPage.goto();

    await agendaPage.expectLoaded();

    // Weryfikacja obecności selektora podopiecznego (ogólne vs konkretny pensjonariusz)
    await expect(agendaPage.residentSelect).toBeVisible();
    const generalOption = agendaPage.residentSelect.locator('option[value=""]');
    await expect(generalOption).toHaveText(/Wszyscy podopieczni|Cała placówka/);

    // Weryfikacja obecności sekcji pór dnia
    await expect(agendaPage.morningSection).toBeVisible();
    await expect(agendaPage.noonSection).toBeVisible();
    await expect(agendaPage.afternoonSection).toBeVisible();
    await expect(agendaPage.eveningSection).toBeVisible();
  });
});
