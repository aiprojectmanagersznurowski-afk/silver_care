import { test, expect } from '../fixtures/base-test';
import { ResidentsListPage } from '../page-objects/ResidentsListPage';

/**
 * @REQ: SUP-IMPERSONATION
 *
 * Ciasteczko impersonacji pozostałe po podglądzie placówki (żyje godzinę, wylogowanie go nie usuwało)
 * nie może odbierać zwykłemu administratorowi widoku jego pensjonariuszy ani prawa edycji.
 */

const staleSession = JSON.stringify({
  targetAdminId: '00000000-0000-4000-8000-000000000001',
  targetOrgId: '00000000-0000-4000-8000-000000000002',
  targetOrgName: 'Placówka',
  adminEmail: '',
  impersonatorId: '00000000-0000-4000-8000-000000000003', // inne konto niż zalogowane
  startedAt: new Date().toISOString(),
});

test.describe('Impersonacja: ciasteczko powiązane z użytkownikiem (@REQ: SUP-IMPERSONATION)', () => {
  test('@REQ: SUP-IMPERSONATION - org_admin z cudzym ciasteczkiem impersonacji nadal widzi swoich pensjonariuszy', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const residents = new ResidentsListPage(page);
    await residents.plantImpersonationCookie(staleSession);
    await residents.goto();

    await expect(residents.impersonationBanner).toHaveCount(0);
    await expect(residents.rows.first()).toBeVisible();
    expect(await residents.rows.count()).toBeGreaterThan(5);
  });

  test('@REQ: SUP-IMPERSONATION - wylogowanie usuwa ciasteczko impersonacji', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const residents = new ResidentsListPage(page);
    await residents.plantImpersonationCookie(staleSession);
    await page.request.post('/auth/signout', { maxRedirects: 0 }).catch(() => undefined);
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'sc_impersonation')).toBeUndefined();
  });
});
