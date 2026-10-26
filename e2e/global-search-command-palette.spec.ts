import { test, expect } from './fixtures/base-test';
import { GlobalSearchPage } from './page-objects/GlobalSearchPage';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 * @REQ: ORG-ISOLATION
 * @REQ: MDR-VOCABULARY
 *
 * Test E2E pełnofunkcyjnej wyszukiwarki globalnej Command Palette / Spotlight Cmd+K (SC-ADM-17).
 */
test.describe('Global Command Palette / Spotlight Cmd+K (@REQ: UI-TEMPLATE-ALIGNMENT, @REQ: UI-ACCESSIBILITY)', () => {
  test('otwiera paletę poleceń, wyszukuje podopiecznych i filtruje po kategoriach', async ({
    loginPage,
    page,
  }) => {
    // 1. Logowanie jako administrator placówki
    await loginPage.loginAs('org_admin');
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    // 2. Przycisk wyzwalacza w nagłówku
    const triggerButton = page.locator('button[aria-label="Wyszukaj w systemie"]');
    await expect(triggerButton).toBeVisible();

    // 3. Otwarcie modalu kliknięciem
    await triggerButton.click();

    // 4. Weryfikacja obecności dialogu Spotlight
    const searchDialog = page.locator('div[role="dialog"][aria-label="Globalna wyszukiwarka systemowa"]');
    await expect(searchDialog).toBeVisible();

    const searchInput = searchDialog.locator('input[type="text"]');
    await expect(searchInput).toBeFocused();

    // 5. Sprawdzenie obecności pigułek kategorii
    const allPill = searchDialog.locator('button:has-text("Wszystko")');
    const residentsPill = searchDialog.locator('button:has-text("Podopieczni")');
    const facilityPill = searchDialog.locator('button:has-text("Pokoje i łóżka")');
    await expect(allPill).toBeVisible();
    await expect(residentsPill).toBeVisible();
    await expect(facilityPill).toBeVisible();

    // 6. Wpisanie frazy wyszukiwania
    await searchInput.fill('Kowalsk');
    await page.waitForTimeout(400); // Odczekaj na debounce i pobranie wyników

    // 7. Filtrowanie kategorii
    await residentsPill.click();
    await page.waitForTimeout(300);

    // 8. Zamknięcie palety klawiszem Escape
    await page.keyboard.press('Escape');
    await expect(searchDialog).not.toBeVisible();

    // 9. Ponowne otwarcie skrótem klawiszowym Control+k (lub Meta+k)
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+k' : 'Control+k');
    await expect(searchDialog).toBeVisible();

    // Zamknięcie przyciskiem X
    const closeButton = searchDialog.locator('button:has(svg.lucide-x)');
    await closeButton.click();
    await expect(searchDialog).not.toBeVisible();
  });
});

test.describe('Wyszukiwarka Cmd+K: dostępność i odporność okna (@REQ: UI-ACCESSIBILITY, @REQ: UI-FOUR-STATES)', () => {
  test('@REQ: UI-ACCESSIBILITY - pole to combobox, wyniki to listbox z opcjami, strzałki przesuwają aktywną opcję', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    await page.goto('/admin');
    const search = new GlobalSearchPage(page);
    await search.open();

    await expect(search.input).toHaveAttribute('role', 'combobox');
    await expect(search.input).toHaveAttribute('aria-expanded', 'false');

    await search.search('an');
    await expect(search.listbox).toBeVisible();
    await expect(search.input).toHaveAttribute('aria-expanded', 'true');
    await expect(search.input).toHaveAttribute('aria-controls', (await search.listbox.getAttribute('id')) as string);

    const count = await search.options.count();
    expect(count).toBeGreaterThan(1);
    await expect(search.input).toHaveAttribute('aria-activedescendant', (await search.options.nth(0).getAttribute('id')) as string);
    await expect(search.options.nth(0)).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowDown');
    await expect(search.input).toHaveAttribute('aria-activedescendant', (await search.options.nth(1).getAttribute('id')) as string);
    await expect(search.options.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(search.options.nth(0)).toHaveAttribute('aria-selected', 'false');
  });

  test('@REQ: UI-ACCESSIBILITY - liczba wyników jest ogłaszana w regionie aria-live', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    await page.goto('/admin');
    const search = new GlobalSearchPage(page);
    await search.open();
    await search.search('an');
    await expect(search.liveRegion).toContainText(/wynik/i);
  });

  test('@REQ: UI-ACCESSIBILITY - po zamknięciu klawiszem Escape fokus wraca na przycisk wyszukiwarki', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    await page.goto('/admin');
    const search = new GlobalSearchPage(page);
    await search.open();
    await page.keyboard.press('Escape');
    await expect(search.dialog).not.toBeVisible();
    await expect(search.trigger).toBeFocused();
  });

  test('@REQ: UI-ACCESSIBILITY - na telefonie okno wyszukiwarki zajmuje cały ekran', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin');
    const search = new GlobalSearchPage(page);
    await search.open();
    // Okno animuje wejście (skalowanie), więc rozmiar mierzymy po jej zakończeniu
    await expect.poll(async () => (await search.dialog.boundingBox())?.width).toBeGreaterThanOrEqual(388);
    await expect.poll(async () => (await search.dialog.boundingBox())?.height).toBeGreaterThanOrEqual(842);
  });

  test('@REQ: UI-FOUR-STATES - przy błędzie połączenia jest przycisk „Spróbuj ponownie”, który ponawia zapytanie', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    await page.goto('/admin');
    const search = new GlobalSearchPage(page);
    await search.open();

    // Blokujemy wszystkie wywołania akcji serwerowej (aplikacja sama powtarza przerwane żądanie), aż do kliknięcia „Spróbuj ponownie”
    let blocking = true;
    await page.route('**/*', async (route) => {
      const req = route.request();
      if (blocking && req.method() === 'POST' && req.headers()['next-action']) {
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });

    await search.search('an');
    await expect(search.retryButton).toBeVisible();
    blocking = false;
    await search.retryButton.click();
    await expect(search.retryButton).not.toBeVisible();
    await expect(search.options.first()).toBeVisible();
  });
});

