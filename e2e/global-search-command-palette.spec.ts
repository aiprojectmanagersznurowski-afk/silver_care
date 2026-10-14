import { test, expect } from './fixtures/base-test';

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
