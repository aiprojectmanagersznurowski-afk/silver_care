import { test, expect } from './fixtures/base-test';
import { MobileNavigationPage } from './page-objects/MobileNavigationPage';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 *
 * Testy responsywności menu i powłoki aplikacji:
 * 1. Dostępność nawigacji w Portalu Rodziny na tabletach (brak martwej strefy 768-1023px).
 * 2. Brak h-scrolla (poziomego rozpychania) na wąskich smartfonach (360px).
 * 3. Zamykanie szuflady mobilnej panelu personelu po kliknięciu linku nawigacyjnego.
 */
test.describe('Responsywność Menu i Widoków Mobilnych (@REQ: UI-TEMPLATE-ALIGNMENT, @REQ: UI-ACCESSIBILITY)', () => {
  test('@REQ: UI-TEMPLATE-ALIGNMENT - Nawigacja Portalu Rodziny jest widoczna na tabletach (768px - 1023px)', async ({ loginPage, page }) => {
    const mobileNav = new MobileNavigationPage(page);
    await mobileNav.setTabletViewport(); // 820px szerokości

    await loginPage.loginAs('family');
    await page.goto('/dashboard');

    // Nawigacja (górna lub dolna) musi być dostępna i widoczna
    await mobileNav.expectFamilyNavigationAvailable();
  });

  test('@REQ: UI-ACCESSIBILITY - Pulpit rodziny nie generuje poziomego paska przewijania (h-scroll) na ekranie 360px', async ({ loginPage, page }) => {
    const mobileNav = new MobileNavigationPage(page);
    await mobileNav.setSmallMobileViewport(); // 360px szerokości

    await loginPage.loginAs('family');
    await page.goto('/dashboard');

    await mobileNav.expectNoHorizontalOverflow();
  });

  test('@REQ: UI-TEMPLATE-ALIGNMENT - Szuflada menu personelu zamyka się automatycznie po kliknięciu linku nawigacji', async ({ loginPage, page }) => {
    const mobileNav = new MobileNavigationPage(page);
    await mobileNav.setMobileViewport(); // 390px szerokości

    await loginPage.loginAs('nurse');
    await page.goto('/staff');

    // Klikamy trigger menu mobilnego (hamburger)
    await expect(mobileNav.sidebarTrigger).toBeVisible();
    await mobileNav.sidebarTrigger.click();

    // Szuflada jest otwarta
    await expect(mobileNav.mobileSheetContent).toBeVisible();

    // Klikamy link "Agenda na dziś" wewnątrz szuflady
    const agendaLink = mobileNav.mobileSheetContent.locator('a[href="/staff/agenda"]');
    await expect(agendaLink).toBeVisible();
    await agendaLink.click();

    // Szuflada powinna się natychmiast zamknąć i odsłonić stronę
    await expect(mobileNav.mobileSheetContent).not.toBeVisible();
    await expect(page).toHaveURL(/\/staff\/agenda/);
  });
});
