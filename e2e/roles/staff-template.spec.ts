import { test, expect } from '../fixtures/base-test';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: MDR-NO-INTERPRETATION
 *
 * PR 3/4 (ADR-014): panel personelu — jeden akcent (zieleń marki z kontraktu),
 * przełącznik widoku z szablonu, statusy bez czerwieni.
 */

const BRAND_GREEN = 'rgb(47, 111, 94)'; // --sc-accent = #2F6F5E

test.describe('Panel personelu — tokeny szablonu (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  test('@REQ: UI-TEMPLATE-ALIGNMENT - przełącznik widoku obchód/karty zaznacza aktywny tryb przez aria-pressed', async ({ loginPage, staffBoardPage }) => {
    await loginPage.loginAs('nurse');
    await staffBoardPage.goto();
    await staffBoardPage.expectStaffBoardLoaded();

    await expect(staffBoardPage.quickRoundsButton).toHaveAttribute('aria-pressed', 'true');
    await expect(staffBoardPage.cardsViewButton).toHaveAttribute('aria-pressed', 'false');
    await staffBoardPage.switchToCards();
    await expect(staffBoardPage.quickRoundsButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('@REQ: UI-TEMPLATE-ALIGNMENT - akcja „Dyktuj" ma kolor akcentu marki, nie granat portalu bliskich', async ({ loginPage, staffBoardPage }) => {
    await loginPage.loginAs('nurse');
    await staffBoardPage.goto();
    await staffBoardPage.expectStaffBoardLoaded();

    const dictate = staffBoardPage.dictateLinks.first();
    await expect(dictate).toBeVisible();
    await expect(dictate).toHaveCSS('background-color', BRAND_GREEN);
  });

  test('@REQ: MDR-NO-INTERPRETATION - tablica personelu nie używa koloru czerwonego dla statusów podopiecznych', async ({ loginPage, staffBoardPage, page }) => {
    await loginPage.loginAs('nurse');
    await staffBoardPage.goto();
    await staffBoardPage.expectStaffBoardLoaded();
    // Filtry statusu renderują się razem z listą — bez tego test sprawdzałby pusty ekran ładowania
    await expect(page.getByRole('button', { name: /Brak wpisu/ }).first()).toBeVisible();

    const redStatuses = await page.evaluate(() => {
      // Przeglądarka zwraca kolory Tailwinda v4 w oklch() — rozkładamy je na RGB przez canvas.
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
      const isRed = (css: string) => {
        if (!css || css === 'rgba(0, 0, 0, 0)' || css === 'transparent') return false;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return a > 40 && r > 170 && g < 120 && b < 120;
      };
      return [...document.querySelectorAll('main *')]
        .filter((el) => {
          const cs = getComputedStyle(el);
          return isRed(cs.color) || isRed(cs.backgroundColor);
        })
        .map((el) => (el.textContent ?? '').trim().slice(0, 40));
    });
    expect(redStatuses).toEqual([]);
  });
});
