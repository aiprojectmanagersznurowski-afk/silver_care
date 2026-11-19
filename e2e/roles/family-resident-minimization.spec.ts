import { test, expect } from '../fixtures/base-test';

/**
 * @REQ: FAM-RESIDENT-DATA-MINIMIZATION
 *
 * SC-FAM-08: portal rodziny działa bez odczytu tabeli residents — nagłówek i zgody pokazują
 * podopiecznego z get_family_resident_overview, a wysłanie wiadomości nie wymaga odczytu residents.
 */
test.describe('Portal rodziny bez odczytu tabeli residents (@REQ: FAM-RESIDENT-DATA-MINIMIZATION)', () => {
  test('@REQ: FAM-RESIDENT-DATA-MINIMIZATION - nagłówek i zgody pokazują podopiecznego', async ({ loginPage, familyDashboardPage, page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginPage.loginAs('family');
    await familyDashboardPage.dismissOnboardingModalIfExists();

    const trigger = page.locator('header').getByText('Wyświetlany profil');
    await expect(trigger).toBeVisible();

    await page.goto('/consents');
    const description = page.locator('main').getByText(/^Podopieczny:/);
    await expect(description).toBeVisible();
    const name = (await description.innerText()).replace(/^Podopieczny:\s*/, '').trim();
    expect(name.length).toBeGreaterThan(0);
    await expect(page.locator('header')).toContainText(name);
  });
});
