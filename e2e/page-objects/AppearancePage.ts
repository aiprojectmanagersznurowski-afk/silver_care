import { Page } from '@playwright/test';

/**
 * Page Object do audytu wyglądu w przeglądarce (ADR-011, ADR-014): jeden akcent,
 * brak gradientów, kolor nie niesie oceny. Mierzy obliczone style, nie nazwy klas —
 * dlatego łapie też kolory wpisane na sztywno i Tailwind v4 zwracający oklch()/lab().
 * @REQ: UI-TEMPLATE-ALIGNMENT
 */
export class AppearancePage {
  constructor(private readonly page: Page) {}

  async goto(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(400);
  }

  /** Elementy z kolorem nasyconym spoza odcieni zieleni marki (czerwień, bursztyn, błękit, fiolet…). */
  async offPaletteElements(): Promise<string[]> {
    return this.page.evaluate(() => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
      const rgba = (css: string) => {
        if (!css || css === 'transparent' || css === 'rgba(0, 0, 0, 0)') return null;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return a > 40 ? [r, g, b] : null;
      };
      const offPalette = (css: string) => {
        const c = rgba(css);
        if (!c) return false;
        const [r, g, b] = c.map((v) => v / 255);
        const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
        const l = (max + min) / 2;
        const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
        if (s < 0.3 || l < 0.08 || l > 0.96) return false;
        let h = 0;
        if (d !== 0) {
          if (max === r) h = ((g - b) / d) % 6;
          else if (max === g) h = (b - r) / d + 2;
          else h = (r - g) / d + 4;
          h = (h * 60 + 360) % 360;
        }
        return h < 125 || h > 200; // zieleń marki ~164°
      };
      return [...document.querySelectorAll('body *')]
        .filter((el) => {
          const cs = getComputedStyle(el);
          return [cs.color, cs.backgroundColor, cs.borderTopColor].some(offPalette)
            && !!(el.textContent ?? '').trim() || offPalette(cs.backgroundColor);
        })
        .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}"`)
        .slice(0, 12);
    });
  }

  async gradientElements(): Promise<string[]> {
    return this.page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .filter((el) => /gradient/.test(getComputedStyle(el).backgroundImage))
        .map((el) => `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 40)}`)
        .slice(0, 12),
    );
  }
}
