import { test, expect } from '../fixtures/base-test';
import { ResidentProfilePage } from '../page-objects/ResidentProfilePage';

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
