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
    await page.waitForLoadState('domcontentloaded');

    // Sprawdzenie obecności paska filtrów tokenowych
    const tokenBar = page.locator('[data-testid="filter-token-bar"]').first();
    await expect(tokenBar).toBeVisible();

    // Sprawdzenie rozwijanego filtra statusu: otwarcie menu, wybór opcji, zamknięcie menu i oznaczenie aktywnego stanu
    const statusTrigger = tokenBar.locator('[data-filter-group="status"] button[data-slot="filter-chip"]').first();
    await expect(statusTrigger).toBeVisible();
    await expect(statusTrigger).toContainText('Status: Wszystkie');
    await statusTrigger.click();

    const readyOption = page.getByRole('menuitemradio', { name: 'Raport gotowy' });
    await expect(readyOption).toBeVisible();
    await readyOption.click();

    // Menu zamyka się po wyborze opcji, a trigger pokazuje wybrany filtr w kolorze marki
    await expect(readyOption).toHaveCount(0);
    await expect(statusTrigger).toContainText('Status: Raport gotowy');

    // Przywrócenie widoku wszystkich statusów przed dalszymi krokami testu
    await statusTrigger.click();
    await page.getByRole('menuitemradio', { name: 'Wszystkie statusy' }).click();
    await expect(statusTrigger).toContainText('Status: Wszystkie');

    // Tablica otwiera się w tabeli; szybki obchód (1-klik) jest jednym z widoków kafelkowych
    await page.locator('[data-slot="view-toggle"]:visible button[aria-label="Widok szybkiego obchodu"]').click();
    // Przycisk „Stan stabilny” został wycofany (brak pozorowanych wpisów, reguła zakazu fabrykowania danych)
    await expect(page.locator('button:has-text("Stan stabilny"), button:has-text("Stabilny")')).toHaveCount(0);
    // Kafelek zawiera przycisk dyktowania notatki oraz wskaźnik liczby notatek
    await expect(page.locator('a:has-text("Dyktuj")').first()).toBeVisible();
    await expect(page.locator('[data-testid="notes-count-indicator"]').first()).toBeVisible();
  });

  test('@REQ: NUR-AGENDA - Menu personelu zawiera dedykowany link "Agenda na dziś"', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    await page.goto('/staff');
    await page.waitForLoadState('domcontentloaded');

    // Weryfikacja menu bocznego
    const agendaMenuItem = page.locator('nav a[href="/staff/agenda"]:has-text("Agenda na dziś")');
    await expect(agendaMenuItem).toBeVisible();

    // Kliknięcie i przejście do agendy
    await agendaMenuItem.click();
    await page.waitForURL('**/staff/agenda');
    await expect(page.locator(':is(h1, h2)').first()).toContainText('Agenda');
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
