import { test, expect } from './fixtures/base-test';

/**
 * @REQ: NUR-BOARD
 *
 * Testy E2E dla panelu personelu opiekuńczego (Staff Portal).
 */

test.describe('Portal Personelu (Staff Portal)', () => {
  test('@REQ: NUR-BOARD - Niezalogowany użytkownik nie ma dostępu do tablicy personelu /staff', async ({ page }) => {
    await page.goto('/staff');
    await expect(page).toHaveURL(/\/(login)?$/);
  });

  test('@REQ: NUR-BOARD - Niezalogowany użytkownik nie ma dostępu do dyktafonu personelu /voice', async ({ page }) => {
    await page.goto('/voice');
    await expect(page).toHaveURL(/\/(login)?$/);
  });

  test('@REQ: NUR-BOARD - Niezalogowany użytkownik nie ma dostępu do raportów personelu /staff/reports', async ({ page }) => {
    await page.goto('/staff/reports');
    await expect(page).toHaveURL(/\/(login)?$/);
  });
});
