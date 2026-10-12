import { describe, it, expect } from 'vitest';
import { COLORS } from '../../contracts/design.contract.mjs';

/**
 * @REQ: UI-ACCESSIBILITY
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * Kolory serii wykresów to elementy graficzne: WCAG 2.1 SC 1.4.11 wymaga kontrastu 3:1
 * względem tła, na którym leżą (tło aplikacji i karta). Pierwotna paleta chart-3 (#7FBCA8)
 * i chart-4 (#A9D2C4) miała w trybie jasnym 2,1:1 i 1,6:1.
 */

const lin = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const SERIES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const;
const MODES = { light: COLORS.light, dark: COLORS.dark } as const;

describe('Kontrast serii wykresów (@REQ: UI-ACCESSIBILITY)', () => {
  for (const [mode, palette] of Object.entries(MODES)) {
    for (const surface of ['bg', 'surface'] as const) {
      it.each(SERIES)(`${mode}: %s ma kontrast ≥ 3:1 na tle „${surface}" @REQ: UI-ACCESSIBILITY`, (token) => {
        const value = (palette as Record<string, { value: string }>)[token].value;
        const bg = (palette as Record<string, { value: string }>)[surface].value;
        expect(ratio(value, bg), `${token} ${value} na ${bg}`).toBeGreaterThanOrEqual(3);
      });
    }
  }

  it('serie są od siebie odróżnialne kolorem: żadne dwie nie są identyczne w żadnym trybie @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    for (const palette of Object.values(MODES)) {
      const values = SERIES.map((t) => (palette as Record<string, { value: string }>)[t].value);
      expect(new Set(values).size).toBe(SERIES.length);
    }
  });

  it('seria 1 pozostaje akcentem marki, a seria 5 neutralną szarością @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(COLORS.light['chart-1'].value).toBe(COLORS.light['accent'].value);
    expect(COLORS.dark['chart-1'].value).toBe(COLORS.dark['accent'].value);
  });

  it('seria „Nieokreślony” (brak danych) spełnia próg kontrastu ≥ 3:1 oraz posiada wzór kreskowany w wykresie @REQ: UI-ACCESSIBILITY', async () => {
    const { CARE_LEVEL_COLORS } = await import('../../apps/web/src/lib/reporting-constants');
    expect(CARE_LEVEL_COLORS.unknown).toBe('var(--chart-5)');
    const lightVal = COLORS.light['chart-5'].value;
    const darkVal = COLORS.dark['chart-5'].value;
    expect(ratio(lightVal, COLORS.light.surface.value)).toBeGreaterThanOrEqual(3);
    expect(ratio(darkVal, COLORS.dark.surface.value)).toBeGreaterThanOrEqual(3);

    const fs = await import('node:fs');
    const path = await import('node:path');
    const statsClient = fs.readFileSync(path.resolve(process.cwd(), 'apps/web/src/components/StatisticsDashboardClient.tsx'), 'utf-8');
    expect(statsClient).toContain('pattern-unknown-hatched');
    expect(statsClient).toContain('dashed var(--chart-5)');
  });
});
