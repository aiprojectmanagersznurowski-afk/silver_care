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
    const sidebarTrigger = page.locator('[data-slot="sidebar-trigger"]');
    if (await sidebarTrigger.isVisible()) {
      await sidebarTrigger.click();
    }
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

    // Zakończenie konkretnego alertu z testu i przywrócenie stanu stabilnego
    await systemStatusPage.resolveAlertByTitle(alertTitle);
    // Czekamy, aż zamknięcie faktycznie się zapisze — inaczej test kończy się przed akcją serwera
    // i zostawia aktywny alert widoczny dla personelu wszystkich placówek na wspólnej bazie.
    await expect(page.locator(`[data-testid="system-alert-item"][data-alert-title="${alertTitle}"]`)).toHaveCount(0, { timeout: 15000 });
    await expect(systemStatusPage.globalAlertBanner.filter({ hasText: alertTitle })).toHaveCount(0);
  });
});

test.describe('Status systemu: wybór dotkniętych modułów (@REQ: UI-FOUR-STATES)', () => {
  test('@REQ: UI-FOUR-STATES - kliknięcie kafelka zaznacza moduł, ponowne kliknięcie odznacza (bez publikowania alertu)', async ({ loginPage, page }) => {
    const systemStatusPage = new SystemStatusPage(page);
    await loginPage.loginAs('super_admin');
    await page.goto('/admin/system-status');
    await systemStatusPage.expectPageLoaded();

    await expect(systemStatusPage.serviceCheckbox('voice_pipeline')).not.toBeChecked();
    await systemStatusPage.toggleServiceCheckbox('voice_pipeline');
    await expect(systemStatusPage.serviceCheckbox('voice_pipeline')).toBeChecked();

    await systemStatusPage.toggleServiceCheckbox('notifications');
    await expect(systemStatusPage.serviceCheckbox('notifications')).toBeChecked();
    await expect(systemStatusPage.serviceCheckbox('voice_pipeline')).toBeChecked();

    await systemStatusPage.toggleServiceCheckbox('voice_pipeline');
    await expect(systemStatusPage.serviceCheckbox('voice_pipeline')).not.toBeChecked();
  });
});

