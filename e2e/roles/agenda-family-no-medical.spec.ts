import { test, expect } from '../fixtures/base-test';
import { StaffAgendaPage } from '../page-objects/StaffAgendaPage.spec.helper';

/**
 * @REQ: FAM-AGENDA-NO-MEDICAL
 *
 * Personel widzi przy wpisie planu dnia, że pozycja z treścią medyczną nie będzie widoczna dla rodziny.
 * Test tylko wpisuje tytuł — niczego nie zapisuje.
 */
test.describe('Plan dnia — informacja o ukryciu przed rodziną (@REQ: FAM-AGENDA-NO-MEDICAL)', () => {
  test('@REQ: FAM-AGENDA-NO-MEDICAL - tytuł z lekami pokazuje informację, zwykły tytuł nie', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    const agenda = new StaffAgendaPage(page);
    await agenda.goto();
    await agenda.expectLoaded();

    await agenda.titleInput.fill('Podanie leków');
    await expect(agenda.familyHiddenHint).toBeVisible();
    await expect(agenda.familyHiddenHint).toContainText('nie będzie widoczny dla rodziny');

    await agenda.titleInput.fill('Wizyta wnuczki');
    await expect(agenda.familyHiddenHint).toHaveCount(0);
  });
});
