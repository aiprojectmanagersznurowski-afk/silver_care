import { test, expect } from './fixtures/base-test';

/**
 * @REQ: ADM-INVITE
 * @REQ: FAM-ONBOARDING
 *
 * Testy E2E dla procesu zaproszeń i dołączania do placówki (onboarding).
 */

test.describe('Onboarding i przyjmowanie zaproszeń', () => {
  test('@REQ: ADM-INVITE - Wejście na /accept-invite bez tokenu przekierowuje do strony głównej', async ({ acceptInvitePage, page }) => {
    await acceptInvitePage.goto();
    await expect(page).toHaveURL(/\/(login)?$/);
  });

  test('@REQ: FAM-ONBOARDING - Wejście z linkiem zaproszenia wyświetla kartę dołączenia bez wycieku danych', async ({ acceptInvitePage, page }) => {
    const inviteConfirmUrl = 'https://example.com/auth/confirm-invite';
    await acceptInvitePage.goto(inviteConfirmUrl);

    // Karta zaproszenia powinna być widoczna z przyciskiem akceptacji
    await acceptInvitePage.expectInviteCard();

    // Weryfikacja, że na karcie nie pojawiają się wrażliwe dane identyfikacyjne (PESEL itp.)
    const content = await page.textContent('body');
    expect(content).not.toContain('PESEL');
    expect(content).toContain('Zaproszenie do placówki');
  });
});
