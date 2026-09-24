import { test, expect } from './fixtures/base-test';

/**
 * @REQ: MDR-VOCABULARY
 *
 * Test E2E sprawdzający przestrzeganie granicy MDR w warstwie prezentacji.
 * Słowo oznaczające osobę leczoną w placówce medycznej jest zakazane w warstwie
 * widocznej dla użytkownika (ADR-004). Dozwolone: podopieczny, senior, pensjonariusz.
 */

test.describe('Zgodność z granicą MDR (Słownictwo warstwy prezentacji)', () => {
  const FORBIDDEN_REGEX = /\b([Pp]acjen[tc]\w*)\b/;

  const pagesToCheck = [
    '/login',
    '/unauthorized',
    '/accept-invite?url=https%3A%2F%2Fexample.com%2Fwelcome',
  ];

  for (const path of pagesToCheck) {
    test(`@REQ: MDR-VOCABULARY - Widok ${path} nie zawiera zakazanego słownictwa klinicznego`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');

      const bodyText = (await page.textContent('body')) || '';
      const match = FORBIDDEN_REGEX.exec(bodyText);

      expect(match, `Znaleziono zakazany termin kliniczny: "${match?.[0]}" na stronie ${path}`).toBeNull();
    });
  }
});
