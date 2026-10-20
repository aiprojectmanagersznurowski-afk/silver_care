import { describe, it, expect } from 'vitest';
import {
  CARE_LEVEL_COLORS,
  CARE_LEVEL_BG_CLASSES,
  CARE_LEVEL_LABELS,
  getCareLevelChartColors,
} from '../../apps/web/src/lib/reporting-constants';
import {
  validateCareLevelNeutrality,
  validateThemeTokens,
} from '../../apps/web/src/lib/ui-theme-validator';
import { COLORS, ACCESSIBILITY } from '@silvercare/contracts/src/generated/design';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: MDR-NO-INTERPRETATION
 *
 * Testy wykonawcze dla panelu personelu (ADR-014, ADR-005):
 * 1. Akcent to zieleń marki (primary), tła i obramowania z tokenów motywu.
 * 2. Kolor nie niesie oceny stanu podopiecznego (brak czerwieni/zieleni jako oceny).
 * 3. Statusy opieki są obiektywnymi faktami, a błędy techniczne używają tokenu destructive.
 */
describe('Panel personelu: tokeny szablonu (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it('posiada zdefiniowane poprawne tokeny motywu aplikacji @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const result = validateThemeTokens(COLORS.light as unknown as Record<string, { value: string }>);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);

    // Akcent marki
    expect(COLORS.light.accent.value).toBe('#2F6F5E');
    // Błędy techniczne
    expect(COLORS.light.destructive.value).toBe('#DC2626');
  });

  it('spełnia normy dostępności celu dotykowego dla personelu @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(ACCESSIBILITY.touchTargetMinimum).toBe('44px');
    expect(ACCESSIBILITY.contrastMinimum).toBeGreaterThanOrEqual(4.5);
  });

  it('poprawnie eksportuje kluczowe komponenty panelu personelu @REQ: UI-TEMPLATE-ALIGNMENT', async () => {
    const boardModule = await import('../../apps/web/src/components/StaffBoardClient');
    expect(typeof boardModule.StaffBoardClient).toBe('function');

    const approverModule = await import('../../apps/web/src/components/BulkReportApprover');
    expect(typeof approverModule.BulkReportApprover).toBe('function');

    const reportCardModule = await import('../../apps/web/src/components/ReportCard');
    expect(typeof reportCardModule.ReportCard).toBe('function');
  });
});

describe('Kolor nie niesie oceny w panelu personelu (@REQ: MDR-NO-INTERPRETATION)', () => {
  it('stany opieki (w tym „Leżący") nie zawierają czerwieni ani oceny klinicznej @REQ: MDR-NO-INTERPRETATION', () => {
    const chartColors = getCareLevelChartColors();
    const neutralityResult = validateCareLevelNeutrality(chartColors, CARE_LEVEL_BG_CLASSES);
    expect(neutralityResult.valid).toBe(true);
    expect(neutralityResult.violations).toEqual([]);

    for (const [level, color] of Object.entries(CARE_LEVEL_COLORS)) {
      expect(color).not.toMatch(/red|rose|destructive/i);
    }
  });

  it('etykiety poziomów opieki są neutralne i opisowe @REQ: MDR-NO-INTERPRETATION', () => {
    expect(CARE_LEVEL_LABELS.walking).toBe('1. Chodzący');
    expect(CARE_LEVEL_LABELS.sitting).toBe('2. Siedzący');
    expect(CARE_LEVEL_LABELS.bedridden).toBe('3. Leżący');
    expect(CARE_LEVEL_LABELS.hospice).toBe('4. Hospicjum');
    expect(CARE_LEVEL_LABELS.unknown).toBe('Nieokreślony');
  });
});
