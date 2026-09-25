import { test, expect } from '../fixtures/base-test';
import { IamPage } from '../page-objects/IamPage.spec.helper';

/**
 * @REQ: SUP-IAM-PANEL
 *
 * Testy E2E dla bezpieczeństwa panelu IAM:
 * AC1: Reset hasła wyłącznie przez bezpieczny link e-mail (brak pola jawnego wpisywania hasła)
 * AC2: Blokada wyboru roli super_admin w UI (brak opcji super_admin w selektorach)
 */
test.describe('IAM Hardening & Privilege Escalation UI (@REQ: SUP-IAM-PANEL)', () => {
  test('@REQ: SUP-IAM-PANEL - AC2: Lista ról do przypisania nie zawiera roli super_admin', async ({ loginPage, page }) => {
    const iamPage = new IamPage(page);
    await loginPage.loginAs('super_admin');
    await iamPage.goto();
    await iamPage.expectLoaded();

    // Sprawdzamy pierwszy wiersz użytkownika (nie-superadmina)
    const select = page.locator('tbody tr select').first();
    await expect(select).toBeVisible();

    const options = await select.locator('option').allTextContents();
    for (const opt of options) {
      expect(opt.toLowerCase()).not.toContain('super admin');
      expect(opt.toLowerCase()).not.toContain('super_admin');
    }
  });

  test('@REQ: SUP-IAM-PANEL - AC1: Dialog resetu hasła nie posiada pola wprowadzania hasła i informuje o wysłaniu linku e-mail', async ({ loginPage, page }) => {
    const iamPage = new IamPage(page);
    await loginPage.loginAs('super_admin');
    await iamPage.goto();
    await iamPage.expectLoaded();

    // Otwarcie modala resetu hasła dla pierwszego użytkownika
    const firstRow = page.locator('tbody tr').first();
    const email = await firstRow.locator('td div.font-medium').first().innerText();
    
    await iamPage.openResetPasswordForUser(email);

    // AC1: Brak pola tekstowego wprowadzania nowego hasła
    await iamPage.expectNoManualPasswordField();

    // AC1: Przycisk wysłania linku resetującego
    await expect(iamPage.sendResetLinkButton).toBeVisible();
  });
});
