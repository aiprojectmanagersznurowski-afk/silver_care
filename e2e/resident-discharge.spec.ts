import { test, expect } from './fixtures/base-test';

/**
 * @REQ: ADM-BED-ASSIGNMENT
 * @REQ: ADM-ARCHIVE
 *
 * Test E2E procesu zakończenia pobytu podopiecznego i rejestracji zgonu (SC-ADM-19, Wariant A i B).
 */
test.describe('Zakończenie pobytu pensjonariusza i rejestracja zgonu (@REQ: ADM-BED-ASSIGNMENT, @REQ: ADM-ARCHIVE)', () => {
  test('administrator placówki ma dostęp do zintegrowanego dialogu zakończenia pobytu', async ({
    loginPage,
    page,
  }) => {
    // 1. Zaloguj jako administrator placówki
    await loginPage.loginAs('org_admin');

    // 2. Przejdź do listy podopiecznych
    await page.goto('/admin/residents');
    await page.waitForLoadState('domcontentloaded');

    // 3. Wybierz pierwszego aktywnego podopiecznego
    const firstResidentLink = page.locator('table tbody tr a').first();
    await expect(firstResidentLink).toBeVisible({ timeout: 10000 });
    await firstResidentLink.click();

    // 4. Widok profilu podopiecznego
    await expect(page).toHaveURL(/\/admin\/residents\/[a-f0-9-]+/);

    // 5. Sprawdzenie obecności przycisku "Zakończ pobyt"
    const dischargeButton = page.locator('button:has-text("Zakończ pobyt")').first();
    await expect(dischargeButton).toBeVisible();

    // 6. Otwarcie dialogu
    await dischargeButton.click();

    // 7. Weryfikacja nagłówka i pól dialogu
    const dialogTitle = page.locator('div[role="dialog"] h2:has-text("Zakończenie pobytu podopiecznego")');
    await expect(dialogTitle).toBeVisible();

    // Sprawdzenie listy powodów zakończenia umowy
    const reasonSelect = page.locator('#discharge-reason');
    await expect(reasonSelect).toBeVisible();

    // Sprawdzenie pola daty zakończenia umowy
    const endDateInput = page.locator('#contract-end-date');
    await expect(endDateInput).toBeVisible();

    // Pole data zgonu nie powinno być widoczne przed wybraniem zgonu
    const deathDateInput = page.locator('#death-date');
    await expect(deathDateInput).not.toBeVisible();

    // 8. Dynamiczne odsłonięcie pola data zgonu po wyborze 'death' (Wariant A)
    await reasonSelect.selectOption('death');
    await expect(deathDateInput).toBeVisible();

    // Weryfikacja etykiety przycisku przy zgonie
    const confirmButton = page.locator('div[role="dialog"] button:has-text("Potwierdź rejestrację zgonu")');
    await expect(confirmButton).toBeVisible();

    // 9. Przełączenie z powrotem na powód rodzinny
    await reasonSelect.selectOption('family_request');
    await expect(deathDateInput).not.toBeVisible();
    await expect(
      page.locator('div[role="dialog"] button:has-text("Zatwierdź zakończenie pobytu")')
    ).toBeVisible();

    // 10. Zamknięcie dialogu przyciskiem Anuluj
    const cancelButton = page.locator('div[role="dialog"] button:has-text("Anuluj")');
    await cancelButton.click();
    await expect(dialogTitle).not.toBeVisible();
  });

  test('personel opiekuńczy (nurse) ma wyłącznie opcję inicjacji zgłoszenia zgonu bez edycji danych i rozwiązania umowy', async ({
    loginPage,
    page,
  }) => {
    await loginPage.loginAs('nurse');

    await page.goto('/staff');
    await page.waitForLoadState('domcontentloaded');

    const firstResidentLink = page.locator('a[href^="/staff/residents/"]').first();
    await expect(firstResidentLink).toBeVisible({ timeout: 10000 });
    await firstResidentLink.click();

    await expect(page).toHaveURL(/\/staff\/residents\/[a-f0-9-]+/);

    // Brak pełnej edycji danych i pełnego rozwiązania umowy
    await expect(page.locator('button:has-text("Edytuj dane")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Zakończ pobyt")')).not.toBeVisible();

    // Obecny wyłącznie przycisk operacyjnej inicjacji zgłoszenia zgonu
    const initiateDeathBtn = page.locator('button:has-text("Zgłoś zgon")').first();
    await expect(initiateDeathBtn).toBeVisible();
    await initiateDeathBtn.click();

    const dialogTitle = page.locator('div[role="dialog"] h2:has-text("Zgłoszenie zgonu podopiecznego")');
    await expect(dialogTitle).toBeVisible();

    // Widoczne wyłącznie pole daty zgonu i uwagi (brak wyboru powodów umowy)
    await expect(page.locator('#death-date')).toBeVisible();
    await expect(page.locator('#discharge-reason')).not.toBeVisible();

    const cancelButton = page.locator('div[role="dialog"] button:has-text("Anuluj")');
    await cancelButton.click();
    await expect(dialogTitle).not.toBeVisible();
  });
});
