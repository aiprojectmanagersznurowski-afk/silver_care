import { test, expect } from './fixtures/base-test';
import { StaffPage } from './page-objects/StaffPage';

/**
 * @REQ: ADM-INVITE
 * @REQ: CONSENT-GRANTOR
 * @REQ: ORG-ISOLATION
 *
 * Testy E2E dla zarządzania personelem i ról zaproszeń (ADM-STAFF-INVITATIONS-ROLES):
 * AC1: Dostępność opcji zapraszania org_admin w formularzu personelu.
 * AC2: Wybór roli opiekun prawny vs viewer dla rodziny w /admin/invitations.
 */
test.describe('Zarządzanie personelem i role zaproszeń (@REQ: ADM-INVITE, @REQ: CONSENT-GRANTOR, @REQ: ORG-ISOLATION)', () => {
  test('@REQ: ADM-INVITE - Formularz personelu pozwala zaprosić administratora placówki (org_admin)', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const staffPage = new StaffPage(page);
    await staffPage.goto();

    await staffPage.openInviteDialog();

    // Weryfikacja opcji Administrator Placówki w select ról
    const orgAdminOption = page.locator('#role option[value="org_admin"]');
    await expect(orgAdminOption).toHaveCount(1);
    await expect(orgAdminOption).toContainText('Administrator Placówki');
  });

  test('@REQ: CONSENT-GRANTOR - Zapraszanie rodziny zawiera jednoznaczny wybór roli opiekun prawny vs obserwator', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    await page.goto('/admin/invitations');
    await page.waitForLoadState('networkidle');

    // Otwarcie dialogu zapraszania rodziny
    const inviteFamilyButton = page.locator('button:has-text("Zaproś członka rodziny")');
    await inviteFamilyButton.click();

    // Weryfikacja selektora ról rodziny
    const familyRoleSelect = page.locator('#family-role');
    await expect(familyRoleSelect).toBeVisible();

    const guardianOption = familyRoleSelect.locator('option[value="legal_guardian"]');
    const familyOption = familyRoleSelect.locator('option[value="family"]');

    await expect(guardianOption).toHaveCount(1);
    await expect(guardianOption).toContainText('Opiekun prawny');

    await expect(familyOption).toHaveCount(1);
    await expect(familyOption).toContainText('Obserwator');
  });
});
