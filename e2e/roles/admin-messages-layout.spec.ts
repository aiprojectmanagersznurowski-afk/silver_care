import { test, expect } from '../fixtures/base-test';
import { StaffMessagesPage } from '../page-objects/StaffMessagesPage.spec.helper';

/**
 * @REQ: FAM-MESSAGES
 *
 * Widok wiadomości kierownika: bez drugiego nagłówka z podtytułem w skrzynce (powtarzał nagłówek strony);
 * przycisk odświeżania zostaje — przy wyszukiwarce wątków (decyzja Michała 2026-10-26).
 */
test.describe('Wiadomości kierownika — układ (@REQ: FAM-MESSAGES)', () => {
  test('@REQ: FAM-MESSAGES - jeden nagłówek strony, odświeżanie przy wyszukiwarce wątków', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const messages = new StaffMessagesPage(page);
    await messages.goto();
    await messages.expectPageLoaded();

    await expect(page.getByText('Skrzynka wiadomości placówki')).toHaveCount(0);
    await expect(page.getByText('Bezpośrednia komunikacja z bliskimi pensjonariuszy placówki.')).toHaveCount(0);

    await expect(messages.refreshButton).toBeVisible();
    await messages.refreshButton.click();
    await expect(messages.threadsList).toBeVisible();
  });
});
