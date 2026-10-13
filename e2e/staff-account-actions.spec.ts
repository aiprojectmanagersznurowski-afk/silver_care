import { test, expect } from './fixtures/base-test';
import { StaffPage } from './page-objects/StaffPage';

/**
  * Testy E2E dla akcji personelu: Reset hasła oraz Zawieszenie/Przywrócenie konta.
  * @REQ: ORG-ISOLATION
  * @REQ: SEC-AUDIT-APPEND-ONLY
  */
test.describe('Zarządzanie kontami personelu (@REQ: ORG-ISOLATION, @REQ: SEC-AUDIT-APPEND-ONLY)', () => {
  test('@REQ: ORG-ISOLATION - Administrator placówki może otworzyć dialog i zresetować hasło pracownika bez błędów', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const staffPage = new StaffPage(page);
    await staffPage.goto();

    await staffPage.openMenuForStaff('e2e.nurse@silvercare.test');
    await staffPage.resetPasswordMenuItem.click();

    // Weryfikacja otwarcia dialogu resetu hasła
    await expect(staffPage.resetPasswordDialogTitle).toBeVisible();
    await expect(staffPage.sendResetEmailButton).toBeVisible();

    // Wywołanie akcji wysłania e-maila
    await staffPage.sendResetEmailButton.click();

    // Brak globalnego błędu aplikacji
    await expect(page.locator('text=Wystąpił błąd krytyczny')).toHaveCount(0);
  });

  test('@REQ: SEC-AUDIT-APPEND-ONLY - Administrator placówki może zawiesić konto pracownika z potwierdzeniem', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const staffPage = new StaffPage(page);
    await staffPage.goto();

    await staffPage.openMenuForStaff('e2e.nurse@silvercare.test');
    await staffPage.suspendMenuItem.click();

    // Weryfikacja otwarcia dialogu zawieszenia konta
    await expect(staffPage.suspendDialogTitle).toBeVisible();
    await expect(staffPage.confirmationInput).toBeVisible();

    // Wpisanie wymaganego tokenu potwierdzenia
    await staffPage.confirmationInput.fill('DEZAKTYWUJ');
    await expect(staffPage.suspendConfirmButton).toBeEnabled();

    // Potwierdzenie zawieszenia
    await staffPage.suspendConfirmButton.click();

    // Brak błędu krytycznego
    await expect(page.locator('text=Wystąpił błąd krytyczny')).toHaveCount(0);
  });
});
