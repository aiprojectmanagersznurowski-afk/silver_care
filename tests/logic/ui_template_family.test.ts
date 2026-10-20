import { describe, it, expect } from 'vitest';
import {
  FAMILY_VISIBLE_METRICS,
  PHYSIOLOGICAL_FIELDS,
  assertFamilyVisible,
  REQUIRED_UI_STATES,
} from '@silvercare/contracts/src/generated/presentation';
import {
  LAYOUT_PRINCIPLES,
  ACCESSIBILITY,
  COLORS,
} from '@silvercare/contracts/src/generated/design';
import { validateAccessibilityStandards } from '../../apps/web/src/lib/ui-theme-validator';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: MDR-NO-PHYSIO-TO-FAMILY
 *
 * Testy wykonawcze dla portalu bliskich:
 * 1. Ograniczenie metryk prezentowanych rodzinie (MDR-NO-PHYSIO-TO-FAMILY): zakaz parametrów fizjologicznych.
 * 2. Zgodność z zasadami kompozycji Mobile-First (quiet-metrics, max-width, one-thing).
 * 3. Spełnienie 4 stanów UI (loading, empty, success, error) i dostępności WCAG.
 */
describe('Portal bliskich: zasady kompozycji i tokeny szablonu (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it('posiada zdefiniowane zasady kompozycji mobile-first i quiet-metrics @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const rules = LAYOUT_PRINCIPLES.map((p) => p.id);
    expect(rules).toContain('mobile-first');
    expect(rules).toContain('quiet-metrics');
    expect(rules).toContain('one-thing');
    expect(rules).toContain('max-width');

    const maxWidthPrinciple = LAYOUT_PRINCIPLES.find((p) => p.id === 'max-width');
    expect(maxWidthPrinciple?.rule).toContain('680px');
  });

  it('spełnia wymogi dostępności WCAG i minimalnego celu dotykowego 44px @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const a11yResult = validateAccessibilityStandards(ACCESSIBILITY);
    expect(a11yResult.valid).toBe(true);
    expect(a11yResult.violations).toEqual([]);
    expect(ACCESSIBILITY.touchTargetMinimum).toBe('44px');
  });

  it('wspiera wymagane 4 stany interfejsu (loading, empty, success, error) @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(REQUIRED_UI_STATES).toEqual(['loading', 'empty', 'success', 'error']);
  });

  it('poprawnie eksportuje kluczowe komponenty portalu bliskich @REQ: UI-TEMPLATE-ALIGNMENT', async () => {
    const headerModule = await import('../../apps/web/src/components/FamilyHeader');
    expect(typeof headerModule.FamilyHeader).toBe('function');

    const switcherModule = await import('../../apps/web/src/components/GlobalResidentSwitcher');
    expect(typeof switcherModule.GlobalResidentSwitcher).toBe('function');
  });
});

describe('Portal bliskich bez parametrów klinicznych (@REQ: MDR-NO-PHYSIO-TO-FAMILY)', () => {
  it('rodzina widzi wyłącznie metryki behawioralne i aktywności @REQ: MDR-NO-PHYSIO-TO-FAMILY', () => {
    const allowedIds = FAMILY_VISIBLE_METRICS.map((m) => m.id);
    expect(allowedIds).toContain('steps_total');
    expect(allowedIds).toContain('active_minutes');
    expect(allowedIds).toContain('sleep_duration_min');

    // Każda metryka rodziny ma rodzaj BEHAVIORAL
    for (const metric of FAMILY_VISIBLE_METRICS) {
      expect(metric.kind).toBe('BEHAVIORAL');
    }
  });

  it('żaden parametr fizjologiczny nie trafia do widoku rodziny @REQ: MDR-NO-PHYSIO-TO-FAMILY', () => {
    for (const field of PHYSIOLOGICAL_FIELDS) {
      expect(() => assertFamilyVisible(field)).toThrow(/ADR-005/);
    }
  });

  it('żadne pole fizjologiczne nie jest obecne na liście FAMILY_VISIBLE_METRICS @REQ: MDR-NO-PHYSIO-TO-FAMILY', () => {
    const allowedIds = FAMILY_VISIBLE_METRICS.map((m) => m.id);
    for (const physio of PHYSIOLOGICAL_FIELDS) {
      expect(allowedIds).not.toContain(physio);
    }
  });
});
