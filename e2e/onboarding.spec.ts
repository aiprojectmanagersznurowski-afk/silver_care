import { test, expect } from './fixtures/base-test';

/**
 * @REQ: ADM-INVITE
 * @REQ: FAM-ONBOARDING
 *
 * Testy E2E dla procesu zaproszeń i dołączania do placówki (onboarding).
 */

test.describe('Onboarding i przyjmowanie zaproszeń', () => {
  test('@REQ: ADM-INVITE - Wejście na /accept-invite bez tokenu wyświetla czytelny stan pusty', async ({ acceptInvitePage, page }) => {
    await acceptInvitePage.goto();
    await acceptInvitePage.expectEmptyState();
    expect(await page.textContent('body')).toContain('Brak aktywnego zaproszenia');
  });

  test('@REQ: FAM-ONBOARDING - Wejście z tokenem zaproszenia rodziny płynnie przekierowuje do rejestracji', async ({ acceptInvitePage, page }) => {
    const familyToken = '00000000-0000-4000-8000-000000000001';
    await acceptInvitePage.gotoToken(familyToken);

    // Powinno nastąpić przekierowanie na /register?token=...
    await page.waitForURL(/\/register\?token=/, { timeout: 10000 });
    expect(page.url()).toContain('/register?token=');
  });

  test('@REQ: FAM-ONBOARDING - Wejście z bezpiecznym linkiem aktywacji wyświetla kartę dołączenia bez wycieku danych', async ({ acceptInvitePage, page }) => {
    const inviteConfirmUrl = '/auth/callback?type=invite';
    await acceptInvitePage.goto(inviteConfirmUrl);

    // Karta zaproszenia powinna być widoczna z przyciskiem akceptacji
    await acceptInvitePage.expectInviteCard();

    // Weryfikacja, że na karcie nie pojawiają się wrażliwe dane identyfikacyjne (PESEL itp.)
    const content = await page.textContent('body');
    expect(content).not.toContain('PESEL');
    expect(content).toContain('Zaproszenie do placówki');
  });

  test('@REQ: ADM-INVITE - Odrzuca próby niebezpiecznego Open Redirect', async ({ acceptInvitePage, page }) => {
    await acceptInvitePage.goto('https://malicious-phishing-site.com/steal');
    await acceptInvitePage.expectErrorState();
    expect(await page.textContent('body')).toContain('Nieprawidłowe zaproszenie');
  });
});
