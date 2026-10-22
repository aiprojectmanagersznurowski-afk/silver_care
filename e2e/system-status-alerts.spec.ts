import { test, expect } from './fixtures/base-test';
import { SystemStatusPage } from './page-objects/SystemStatusPage';

/**
 * @REQ: SUP-IAM-PANEL
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-FOUR-STATES
 * @REQ: ADM-FACILITY-OCCUPANCY
 *
 * Testy E2E dla SC-SUP-05: Globalne alerty systemowe i status platformy (Wariant A).
 */

test.describe('SC-SUP-05: Status systemu i globalne alerty serwisowe (Wariant A)', () => {
  test('@REQ: ADM-FACILITY-OCCUPANCY - Pulpit placówki (org_admin) nie zawiera atrapy "Status systemu: Stabilny" i prezentuje metrykę raportów', async ({
    loginPage,
    adminDashboardPage,
    page,
  }) => {
    const systemStatusPage = new SystemStatusPage(page);
    await loginPage.loginAs('org_admin');

    await expect(page).toHaveURL(/\/admin$/);
    await adminDashboardPage.expectDashboardLoaded();

    // Wariant A: Brak statycznego kafelka "Status systemu" na pulpicie placówki
    await expect(page.locator('p:has-text("Status systemu")')).toBeHidden();
    // W jego miejsce widoczna metryka operacyjna placówki
    await expect(page.locator('p:has-text("Raporty do zatwierdzenia")')).toBeVisible();

    // Org Admin nie widzi linku do zarządzania statusem systemu w sidebarze
    await expect(systemStatusPage.sidebarLink).toBeHidden();

    // Próba bezpośredniego wejścia na /admin/system-status przekierowuje do /admin
    await systemStatusPage.goto();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('@REQ: SUP-IAM-PANEL @REQ: UI-FOUR-STATES - Super Admin zarządza statusem systemu, publikuje alert dla placówek i przywraca stan stabilny', async ({
    loginPage,
    page,
  }) => {
    const systemStatusPage = new SystemStatusPage(page);
    await loginPage.loginAs('super_admin');

    // Super Admin widzi pozycję w nawigacji bocznej
    await expect(systemStatusPage.sidebarLink).toBeVisible();
    await systemStatusPage.navigateFromSidebar();
    await systemStatusPage.expectPageLoaded();

    // Publikacja alertu serwisowego o pracach nad potokiem głosowym
    const alertTitle = `Prace serwisowe E2E ${Date.now()}`;
    await systemStatusPage.publishAlert({
      title: alertTitle,
      message: 'Trwają prace konserwacyjne nad modułem transkrypcji głosowej. Wpisy ręczne działają poprawnie.',
      severity: 'warning',
      status: 'maintenance',
      services: ['voice_pipeline'],
    });

    // Globalny banner ostrzegawczy pojawia się na górze interfejsu
    await expect(systemStatusPage.globalAlertBanner).toBeVisible();
    await expect(systemStatusPage.globalAlertBanner).toContainText(alertTitle);

    // Zakończenie alertu i przywrócenie stanu stabilnego
    await systemStatusPage.resolveFirstActiveAlert();
    await expect(page.locator(`text=${alertTitle}`).first()).toBeVisible();
  });
});
