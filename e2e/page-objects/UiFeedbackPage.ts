import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla weryfikacji globalnego feedbacku UI (Toasty, Dialogi potwierdzeń, Tooltipy).
 * @REQ: UI-ACCESSIBILITY
 */
export class UiFeedbackPage {
  readonly page: Page;
  readonly toaster: Locator;
  readonly alertDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toaster = page.locator('section[aria-label*="Notifications"], [data-sonner-toaster], [data-sonner-toasts]');
    this.alertDialog = page.locator('[role="alertdialog"]');
  }

  async expectToasterMounted() {
    await expect(this.toaster).toBeAttached();
  }

  setupNativeDialogTrap() {
    let nativeDialogTriggered = false;
    let dialogMessage = '';
    this.page.on('dialog', (dialog) => {
      nativeDialogTriggered = true;
      dialogMessage = dialog.message();
      dialog.dismiss();
    });
    return {
      assertNoNativeDialogTriggered: () => {
        expect(nativeDialogTriggered, `Natywny dialog przeglądarki został wywołany: "${dialogMessage}"`).toBe(false);
      },
    };
  }
}
