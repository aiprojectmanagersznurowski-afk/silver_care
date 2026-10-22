import { test, expect } from '../fixtures/base-test';
import { StaffMessagesPage } from '../page-objects/StaffMessagesPage.spec.helper';

/**
 * @REQ: FAM-MESSAGES
 * @REQ: NUR-BOARD
 * @REQ: UI-ACCESSIBILITY
 *
 * Testy E2E dla modułu wiadomości personelu (odczyt wiadomości od rodzin i odpowiedź).
 */

test.describe('Skrzynka Wiadomości od rodzin — dostęp wyłącznie dla org_admin (@REQ: FAM-MESSAGES, @REQ: NUR-BOARD)', () => {
  test('@REQ: FAM-MESSAGES - Niezalogowany użytkownik nie ma dostępu do /admin/messages', async ({ page }) => {
    await page.goto('/admin/messages');
    await expect(page).toHaveURL(/\/login/);
  });

  test('@REQ: FAM-MESSAGES - Kierownik placówki (org_admin) widzi link do Wiadomości w menu bocznym i może wejść do skrzynki odbiorczej', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    await expect(page).toHaveURL(/\/admin$/);

    // Weryfikacja obecności linku w menu bocznym administratora placówki (otwieramy szufladę jeśli mobile)
    const sidebarTrigger = page.locator('[data-slot="sidebar-trigger"]');
    if (await sidebarTrigger.isVisible()) {
      await sidebarTrigger.click();
    }
    const messagesNavLink = page.locator('a[href="/admin/messages"]').first();
    await expect(messagesNavLink).toBeVisible();
    await expect(messagesNavLink).toContainText(/Wiadomości/i);

    // Przejście do skrzynki wiadomości
    await messagesNavLink.click();
    await page.waitForURL('**/admin/messages');

    const messagesPage = new StaffMessagesPage(page);
    await messagesPage.expectPageLoaded();
  });

  test('@REQ: FAM-MESSAGES - Widok skrzynki wiadomości kierownika ładuje interfejs konwersacji z polem odpowiedzi', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    await page.goto('/admin/messages');

    const messagesPage = new StaffMessagesPage(page);
    await messagesPage.expectPageLoaded();

    // Weryfikacja obecności komponentu skrzynki (listy wątków lub stanu pustego)
    const inboxVisible = await messagesPage.threadsList.isVisible().catch(() => false);
    const emptyStateVisible = await messagesPage.emptyState.isVisible().catch(() => false);

    expect(inboxVisible || emptyStateVisible).toBe(true);
  });

  test('@REQ: FAM-MESSAGES - Personel opiekuńczy (nurse) nie ma linku do Wiadomości i nie ma dostępu do skrzynki wiadomości', async ({ loginPage, staffBoardPage, page }) => {
    await loginPage.loginAs('nurse');
    await staffBoardPage.goto();
    await staffBoardPage.expectStaffBoardLoaded();

    await expect(page.locator('a[href="/staff/messages"], a[href="/admin/messages"]')).toHaveCount(0);
    await expect(staffBoardPage.buttonsNestedInLinks).toHaveCount(0);

    await page.goto('/staff/messages');
    await expect(page).toHaveURL(/\/unauthorized$/);
  });
});
