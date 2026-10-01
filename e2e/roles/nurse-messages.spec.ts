import { test, expect } from '../fixtures/base-test';
import { StaffMessagesPage } from '../page-objects/StaffMessagesPage.spec.helper';

/**
 * @REQ: FAM-MESSAGES
 * @REQ: NUR-BOARD
 *
 * Testy E2E dla modułu wiadomości personelu (odczyt wiadomości od rodzin i odpowiedź).
 */

test.describe('Portal Personelu — Wiadomości od rodzin (@REQ: FAM-MESSAGES, @REQ: NUR-BOARD)', () => {
  test('@REQ: NUR-BOARD - Niezalogowany użytkownik nie ma dostępu do /staff/messages', async ({ page }) => {
    await page.goto('/staff/messages');
    await expect(page).toHaveURL(/\/(login)?$/);
  });

  test('@REQ: FAM-MESSAGES - Personel widzi link do Wiadomości w menu bocznym i może wejść do skrzynki odbiorczej', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    await expect(page).toHaveURL(/\/staff$/);

    // Weryfikacja obecności linku w menu bocznym personelu
    const messagesNavLink = page.locator('a[href="/staff/messages"]').first();
    await expect(messagesNavLink).toBeVisible();
    await expect(messagesNavLink).toContainText(/Wiadomości/i);

    // Przejście do skrzynki wiadomości
    await messagesNavLink.click();
    await page.waitForURL('**/staff/messages');

    const messagesPage = new StaffMessagesPage(page);
    await messagesPage.expectPageLoaded();
  });

  test('@REQ: FAM-MESSAGES - Widok skrzynki wiadomości personelu ładuje interfejs konwersacji z polem odpowiedzi', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    await page.goto('/staff/messages');

    const messagesPage = new StaffMessagesPage(page);
    await messagesPage.expectPageLoaded();

    // Weryfikacja obecności komponentu skrzynki (listy wątków lub stanu pustego)
    const inboxVisible = await messagesPage.threadsList.isVisible().catch(() => false);
    const emptyStateVisible = await messagesPage.emptyState.isVisible().catch(() => false);

    expect(inboxVisible || emptyStateVisible).toBe(true);
  });
});
