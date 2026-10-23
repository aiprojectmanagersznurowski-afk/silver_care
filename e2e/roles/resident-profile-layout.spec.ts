import { test, expect } from '../fixtures/base-test';
import { ResidentProfilePage } from '../page-objects/ResidentProfilePage';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * Profil podopiecznego w układzie profilu szablonu shadcn-admin: zakładki w stylu linii,
 * w „Przeglądzie” treść główna i pasek boczny z umową, pozostałe sekcje w osobnych zakładkach.
 */
test.describe('Profil podopiecznego — układ szablonu (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  test('@REQ: UI-TEMPLATE-ALIGNMENT - zakładki profilu, domyślnie Przegląd z paskiem bocznym umowy', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    await page.setViewportSize({ width: 1440, height: 900 });
    const profile = new ResidentProfilePage(page);
    await profile.openFirstFromList();

    expect(await profile.tabNames()).toEqual(['Przegląd', 'Rodzina i kontakty', 'Zdarzenia', 'Opaska']);
    await expect(profile.tab('Przegląd')).toHaveAttribute('aria-selected', 'true');
    await expect(profile.sidebar).toBeVisible();
    await expect(profile.sidebar.locator('[data-slot="card-title"]')).toContainText('Umowa');

    await profile.tab('Rodzina i kontakty').click();
    await expect(profile.tab('Rodzina i kontakty')).toHaveAttribute('aria-selected', 'true');
    expect((await profile.visibleCardTitles()).join(' ')).toMatch(/Rodzina/);

    await profile.tab('Opaska').click();
    expect((await profile.visibleCardTitles()).join(' ')).toMatch(/Opaska/);
  });
});
