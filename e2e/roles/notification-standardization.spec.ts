import { test, expect } from '../fixtures/base-test';

/**
 * @REQ: NTF-REPORT-READY
 * @REQ: NTF-NO-PII
 *
 * Testy E2E dla powiadomień transactional outbox, brandingu i akceptacji zaproszeń.
 */

test.describe('Standardized Notifications & Invitations (@REQ: NTF-REPORT-READY, @REQ: NTF-NO-PII)', () => {
  test('Sprawdzenie strony akceptacji zaproszenia pod kątem stylizacji, brandingu i braku PII', async ({
    acceptInvitePage,
    page,
  }) => {
    // 1. Wejście na stronę akceptacji zaproszenia z poprawnym parametrem url
    await acceptInvitePage.goto('https://silvercare.test/auth/callback');

    // 2. Weryfikacja elementów wizualnych i brandingu
    await acceptInvitePage.expectInviteCard();
    await expect(acceptInvitePage.logoImage).toBeVisible();

    // 3. Weryfikacja braku zakazanych słów (ADR-004: brak słowa "pacjent")
    const pageBody = await page.textContent('body');
    expect(pageBody?.toLowerCase()).not.toContain('pacjent');
  })

  test('Weryfikacja procesu transactional outbox API cron', async ({ request }) => {
    // Odpytanie endpointu outbox process-outbox
    const response = await request.get('/api/cron/process-outbox');

    // Endpoint powinien zwrócić 200 (lub 401 jeśli CRON_SECRET jest wymagany)
    expect([200, 401]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toBeDefined();
      // Upewnienie się, że odpowiedź techniczna nie zawiera PII
      const jsonStr = JSON.stringify(data).toLowerCase();
      expect(jsonStr).not.toContain('pacjent');
      expect(jsonStr).not.toContain('pesel');
    }
  });
});
