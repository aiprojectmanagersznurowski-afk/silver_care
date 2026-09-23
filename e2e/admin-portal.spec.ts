import { test, expect } from './fixtures/base-test';

/**
 * @REQ: ADM-FACILITY-OCCUPANCY
 * @REQ: SUP-IAM-PANEL
 *
 * Testy E2E dla panelu administracyjnego placówki i platformy.
 */

test.describe('Portal Administratora (Admin Portal)', () => {
  test('@REQ: ADM-FACILITY-OCCUPANCY - Niezalogowany użytkownik nie ma dostępu do modułu obłożenia /admin/facility', async ({ page }) => {
    await page.goto('/admin/facility');
    await expect(page).toHaveURL(/\/(login)?$/);
  });

  test('@REQ: SUP-IAM-PANEL - Panel zarządzania uprawnieniami /admin/iam jest zabezpieczony', async ({ page }) => {
    await page.goto('/admin/iam');
    await expect(page).toHaveURL(/\/(login)?$/);
  });
});
