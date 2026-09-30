import { test, expect } from './fixtures/base-test';
import { UiFeedbackPage } from './page-objects/UiFeedbackPage';

/**
 * @REQ: UI-ACCESSIBILITY
 * @REQ: UI-FOUR-STATES
 * Testy E2E dla globalnego systemu feedbacku:
 * - Weryfikacja obecności kontenera Toaster (sonner)
 * - Weryfikacja braku natywnych okien alert/confirm
 */
test.describe('Feedback UI & Tooltips (@REQ: UI-ACCESSIBILITY, @REQ: UI-FOUR-STATES)', () => {
  test('@REQ: UI-ACCESSIBILITY - Globalny Toaster (sonner) jest zamontowany w DOM na stronie logowania', async ({ page }) => {
    const feedback = new UiFeedbackPage(page);
    const trap = feedback.setupNativeDialogTrap();

    await page.goto('/login');
    await feedback.expectToasterMounted();
    trap.assertNoNativeDialogTriggered();
  });

  test('@REQ: UI-FOUR-STATES - Strona główna renderuje toaster i nie wyzwala natywnych dialogów przeglądarki', async ({ page }) => {
    const feedback = new UiFeedbackPage(page);
    const trap = feedback.setupNativeDialogTrap();

    await page.goto('/');
    await feedback.expectToasterMounted();
    trap.assertNoNativeDialogTriggered();
  });
});
