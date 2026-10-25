import { test, expect } from '../fixtures/base-test';
import { ResidentProfilePage } from '../page-objects/ResidentProfilePage';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: ADM-RESIDENT-CARD-VISIBILITY
 * @REQ: SEC-PESEL-HASH
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

    // Zakładki z sekcji kontraktu (RESIDENT_CARD_SECTIONS) dla kierownika, w kolejności z kontraktu
    expect(await profile.tabNames()).toEqual(['Przegląd', 'Aktywność i sen', 'Raporty i plan dnia', 'Bliscy i kontakty', 'Zdarzenia pobytu', 'Opaska']);
    await expect(profile.tab('Przegląd')).toHaveAttribute('aria-selected', 'true');
    await expect(profile.sidebar).toBeVisible();
    await expect(profile.sidebar.locator('[data-slot="card-title"]')).toContainText('Umowa');

    await profile.tab('Bliscy i kontakty').click();
    await expect(profile.tab('Bliscy i kontakty')).toHaveAttribute('aria-selected', 'true');
    expect((await profile.visibleCardTitles()).join(' ')).toMatch(/Bliscy/);

    await profile.tab('Opaska').click();
    expect((await profile.visibleCardTitles()).join(' ')).toMatch(/Opaska/);
  });
});

test.describe('Karta podopiecznego kierownika — dane według kontraktu (@REQ: ADM-RESIDENT-CARD-VISIBILITY, @REQ: SEC-PESEL-HASH)', () => {
  test('@REQ: SEC-PESEL-HASH - skrót PESEL nie jest pokazywany ani przesyłany do przeglądarki', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const profile = new ResidentProfilePage(page);
    await profile.openFirstFromList();
    await expect(page.getByText('PESEL (skrót kryptograficzny)')).toHaveCount(0);
    expect(await page.content()).not.toContain('pesel_hash');
  });

  test('@REQ: ADM-RESIDENT-CARD-VISIBILITY - aktywność i sen: jawny brak danych, bez zmyślonych wartości', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const profile = new ResidentProfilePage(page);
    await profile.openFirstFromList();
    await profile.tab('Aktywność i sen').click();
    await expect(page.locator('main [data-slot="list-empty"]:visible')).toContainText('Brak danych o aktywności i śnie');
  });

  test('@REQ: ADM-RESIDENT-CARD-VISIBILITY - raporty i plan dnia: lista albo jawny stan pusty', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const profile = new ResidentProfilePage(page);
    await profile.openFirstFromList();
    await profile.tab('Raporty i plan dnia').click();
    expect((await profile.visibleCardTitles()).join(' ')).toMatch(/Ostatnie raporty/);
    expect((await profile.visibleCardTitles()).join(' ')).toMatch(/Plan dnia/);
  });
});

