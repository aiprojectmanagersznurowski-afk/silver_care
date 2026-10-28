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

test.describe('Wiadomości kierownika — wątki (@REQ: FAM-MESSAGES)', () => {
  test('@REQ: FAM-MESSAGES - wątek pokazuje, kto z bliskich pisze; filtr Do odpowiedzi', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const messages = new StaffMessagesPage(page);
    await messages.goto();
    await expect(messages.threadItems.first()).toBeVisible();

    const relative = messages.threadItems.first().locator('[data-testid="thread-relative"]');
    await expect(relative).toHaveText(/^(Opiekun prawny|Członek rodziny|Brak danych o roli bliskiego)/);

    await messages.awaitingFilter.click();
    await expect(messages.awaitingFilter).toHaveAttribute('aria-pressed', 'true');
    const shown = await messages.threadItems.count();
    for (let i = 0; i < shown; i++) {
      await expect(messages.threadItems.nth(i).getByText('Do odpowiedzi')).toBeVisible();
    }
  });

  test('@REQ: FAM-MESSAGES - odświeżanie w tle nie zmienia wybranego wątku', async ({ loginPage, page }) => {
    await page.clock.install();
    await loginPage.loginAs('org_admin');
    const messages = new StaffMessagesPage(page);
    await messages.goto();
    await expect(messages.threadItems.nth(1)).toBeVisible();

    await messages.threadItems.nth(1).click();
    const chosen = (await messages.threadItems.nth(1).locator('[data-testid="thread-resident"]').innerText()).trim();
    await expect(messages.conversationHeader).toContainText(chosen);

    // Odświeżanie skrzynki w tle (z ?since=); inne komponenty też pytają /api/admin/messages
    const refreshed = page.waitForResponse((r) => r.url().includes('/api/admin/messages?since=') && r.request().method() === 'GET');
    await page.clock.fastForward(31_000);
    await refreshed;
    // Czas rzeczywisty (nie zegar strony) na przerysowanie widoku po odpowiedzi
    await page.waitForTimeout(1000);
    await expect(messages.conversationHeader).toContainText(chosen);
  });

  test('@REQ: FAM-MESSAGES - dedykowany stan pusty listy wątków przy włączonym filtrze Do odpowiedzi', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const messages = new StaffMessagesPage(page);
    await messages.goto();
    await messages.expectPageLoaded();

    await messages.searchInput.fill('__brak_takiego_podopiecznego__');
    await expect(messages.emptyState).toBeVisible();
    await expect(messages.emptyState).toContainText('Brak wyników wyszukiwania');

    await messages.searchInput.fill('');
    await messages.awaitingFilter.click();
    const count = await messages.threadItems.count();
    if (count === 0) {
      await expect(messages.emptyState).toBeVisible();
      await expect(messages.emptyState).toContainText('Wszystkie wiadomości od rodzin zostały obsłużone');
    }
  });
});
