import { test, expect } from './fixtures/base-test';

/**
 * @REQ: ADM-RESIDENT-ADD
 * @REQ: SEC-NO-PII-LOGS
 * @REQ: UI-ACCESSIBILITY
 *
 * Testy E2E dla optymalizacji mediów (SYS-MEDIA-OPTIMIZATION):
 * AC1: Komponent MediaUploader dostępny w kartach podopiecznych.
 * AC2: Brak blokującego okna window.alert().
 * AC3: Akceptowane wyłącznie formaty graficzne w polu input (accept="image/*").
 */
test.describe('Optymalizacja mediów i upload zdjęć (@REQ: ADM-RESIDENT-ADD, @REQ: SEC-NO-PII-LOGS, @REQ: UI-ACCESSIBILITY)', () => {
  test('@REQ: UI-ACCESSIBILITY - MediaUploader posiada pole wyboru obrazu oraz estetyczny przycisk interakcji', async ({ loginPage, page }) => {
    let alertTriggered = false;
    page.on('dialog', async (dialog) => {
      alertTriggered = true;
      await dialog.dismiss();
    });

    await loginPage.loginAs('nurse');
    await page.goto('/staff');
    await page.waitForLoadState('networkidle');

    // Przełączenie na widok kart podopiecznych
    const cardsButton = page.locator('button:has-text("Karty")');
    await cardsButton.click();

    // Sprawdzenie obecności komponentu MediaUploader
    const uploadButton = page.locator('button:has-text("Dodaj zdjęcie")').first();
    await expect(uploadButton).toBeVisible();

    // Sprawdzenie czy input pliku akceptuje wyłącznie obrazy
    const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
    await expect(fileInput).toBeAttached();

    // Weryfikacja że nie pojawiło się żadne okienko alert
    expect(alertTriggered).toBe(false);
  });
});
