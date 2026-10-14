import { test, expect } from './fixtures/base-test';

/**
 * @REQ: FAM-MESSAGES
 * @REQ: NUR-BOARD
 *
 * Testy E2E dla dzwonka powiadomień oraz wyróżnień zakładek w menu nawigacji
 * na Portalu Rodziny oraz Portalu Personelu.
 */
test.describe('Dzwonek alertów i wyróżnienia zakładek nawigacji (@REQ: FAM-MESSAGES, @REQ: NUR-BOARD)', () => {
  test('@REQ: NUR-BOARD - Personel widzi dzwonek alertów systemowych w nagłówku i link do wiadomości', async ({
    loginPage,
    page,
  }) => {
    await loginPage.loginAs('nurse');
    await expect(page).toHaveURL(/\/staff/);

    // Dzwonek alertów systemowych w nagłówku panelu personelu
    const bellButton = page.locator('[data-testid="staff-notifications-bell"]');
    await expect(bellButton).toBeVisible();

    // Pozycja Wiadomości w menu bocznym personelu
    const messagesSidebarLink = page.locator('a[href="/staff/messages"]').first();
    await expect(messagesSidebarLink).toBeVisible();

    // Rozwinięcie menu dzwonka
    await bellButton.click();
    const dropdown = page.locator('[data-testid="staff-notifications-dropdown"]');
    await expect(dropdown).toBeVisible();
    await expect(dropdown).toContainText(/Alerty i wiadomości|Powiadomienia/i);

    // Link do skrzynki wiadomości w dropdownie
    const goToMessagesLink = dropdown.locator('a[href="/staff/messages"]');
    await expect(goToMessagesLink).toBeVisible();

    // Przejście do skrzynki wiadomości z poziomu powiadomień
    await goToMessagesLink.click();
    await page.waitForURL('**/staff/messages');
    await expect(page.locator('h1')).toContainText('Wiadomości');
  });

  test('@REQ: FAM-MESSAGES - Rodzina widzi dzwonek powiadomień oraz zakładkę Wiadomości w menu', async ({
    loginPage,
    familyDashboardPage,
    page,
  }) => {
    await loginPage.loginAs('family');
    await expect(page).toHaveURL(/\/dashboard$/);
    await familyDashboardPage.dismissOnboardingModalIfExists();

    // Dzwonek powiadomień w nagłówku rodziny
    const bellButton = page.locator('[data-testid="family-notifications-bell"]');
    await expect(bellButton).toBeVisible();

    // Zakładka Wiadomości w menu nawigacyjnym rodziny
    const messagesNavLink = page.locator('header a[href="/messages"]');
    await expect(messagesNavLink).toBeVisible();
    await expect(messagesNavLink).toContainText('Wiadomości');

    // Rozwinięcie menu powiadomień dzwonka
    await bellButton.click();
    const dropdown = page.locator('[data-testid="family-notifications-dropdown"]');
    await expect(dropdown).toBeVisible();
    await expect(dropdown).toContainText('Powiadomienia');

    // Link do wiadomości w dropdownie
    const goToMessages = dropdown.locator('a[href="/messages"]').last();
    await expect(goToMessages).toBeVisible();
    await goToMessages.click();

    await page.waitForURL('**/messages');
    await expect(page.locator('h2')).toContainText('Wiadomości');
  });
});
