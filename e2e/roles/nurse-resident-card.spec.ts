import { test, expect } from '../fixtures/base-test';
import { ResidentProfilePage } from '../page-objects/ResidentProfilePage';
import { StaffBoardPage } from '../page-objects/StaffBoardPage';

/**
 * @REQ: ADM-RESIDENT-CARD-VISIBILITY
 * @REQ: SEC-PESEL-HASH
 * @REQ: ORG-ISOLATION
 *
 * Karta podopiecznego dla personelu opiekuńczego pod /staff/residents/[id]: ta sama karta co u kierownika,
 * ale wyłącznie sekcje przyznane pielęgniarce w kontrakcie (bez bliskich, umowy, pakietów, zdarzeń i opaski)
 * i bez akcji zapisu. Dane spoza tych sekcji nie trafiają do przeglądarki.
 */
test.describe('Karta podopiecznego — personel opiekuńczy (@REQ: ADM-RESIDENT-CARD-VISIBILITY)', () => {
  test('@REQ: ADM-RESIDENT-CARD-VISIBILITY - pielęgniarka widzi tylko swoje sekcje, bez paska umowy i akcji zapisu', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    await page.setViewportSize({ width: 1440, height: 900 });
    const card = new ResidentProfilePage(page);
    await card.openStaffCard(await card.firstResidentIdFromStaffBoard());

    expect(await card.tabNames()).toEqual(['Przegląd', 'Aktywność i sen', 'Raporty i plan dnia']);
    await expect(card.sidebar).toHaveCount(0);
    await expect(page.getByTestId('edit-resident-btn')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Zakończ pobyt' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Wróć do tablicy dyżuru' })).toHaveAttribute('href', '/staff');
  });

  test('@REQ: SEC-PESEL-HASH - do przeglądarki pielęgniarki nie trafiają dane spoza jej sekcji', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    const card = new ResidentProfilePage(page);
    await card.openStaffCard(await card.firstResidentIdFromStaffBoard());
    // Najpierw karta musi się wczytać — inaczej sprawdzalibyśmy pustą stronę błędu
    await expect(card.tab('Przegląd')).toBeVisible();

    const html = await page.content();
    for (const hidden of ['pesel_hash', 'resident_relative_links', 'resident_packages', 'resident_events', 'contract_monthly_rate', 'contract_document_path']) {
      expect(html, hidden).not.toContain(hidden);
    }
  });

  test('@REQ: ADM-RESIDENT-CARD-VISIBILITY - „Wszystkie raporty” prowadzi do raportów personelu dla tego podopiecznego', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    const card = new ResidentProfilePage(page);
    const id = await card.firstResidentIdFromStaffBoard();
    await card.openStaffCard(id);
    await card.tab('Raporty i plan dnia').click();
    await expect(page.getByRole('link', { name: 'Wszystkie raporty' })).toHaveAttribute('href', `/staff/reports?resident=${id}`);
  });

  test('@REQ: ORG-ISOLATION - rodzina nie otwiera karty personelu, a pielęgniarka nie otwiera karty kierownika', async ({ loginPage, page, browser }) => {
    await loginPage.loginAs('nurse');
    const card = new ResidentProfilePage(page);
    const id = await card.firstResidentIdFromStaffBoard();

    await page.goto(`/admin/residents/${id}`);
    await expect(page).not.toHaveURL(new RegExp(`/admin/residents/${id}`));

    const context = await browser.newContext();
    const familyPage = await context.newPage();
    const { LoginPage } = await import('../page-objects/LoginPage');
    await new LoginPage(familyPage).loginAs('family');
    await familyPage.goto(`/staff/residents/${id}`);
    await expect(familyPage).not.toHaveURL(new RegExp(`/staff/residents/${id}`));
    await context.close();
  });
});

test.describe('Tablica dyżuru prowadzi do karty podopiecznego (@REQ: ADM-RESIDENT-CARD-VISIBILITY)', () => {
  test('@REQ: ADM-RESIDENT-CARD-VISIBILITY - nazwisko w tabeli to link do karty personelu, który ją otwiera', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    const board = new StaffBoardPage(page);
    await board.goto();
    await board.expectStaffBoardLoaded();

    const link = board.residentCardLinks.first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /^\/staff\/residents\/[0-9a-f-]{36}$/);
    await link.click();
    await page.waitForURL(/\/staff\/residents\/[0-9a-f-]{36}$/);
    await expect(new ResidentProfilePage(page).tab('Przegląd')).toBeVisible();
  });

  test('@REQ: ADM-RESIDENT-CARD-VISIBILITY - w widoku kart i obchodu nazwisko też prowadzi do karty', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    const board = new StaffBoardPage(page);
    await board.goto();
    await board.expectStaffBoardLoaded();

    await board.cardsViewButton.click();
    await expect(board.residentCardLinks.first()).toHaveAttribute('href', /^\/staff\/residents\/[0-9a-f-]{36}$/);

    await board.quickRoundsButton.click();
    await expect(board.residentCardLinks.first()).toHaveAttribute('href', /^\/staff\/residents\/[0-9a-f-]{36}$/);
    await expect(board.buttonsNestedInLinks).toHaveCount(0);
  });
});

