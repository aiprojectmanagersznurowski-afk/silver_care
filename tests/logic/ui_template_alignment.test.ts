import { describe, it, expect } from 'vitest';
import {
  TYPOGRAPHY,
  ACCESSIBILITY,
  COLORS,
  SPACING,
  RADIUS,
  ELEVATION,
  MOTION,
} from '@silvercare/contracts/src/generated/design';
import {
  FAMILY_VISIBLE_METRICS,
  PHYSIOLOGICAL_FIELDS,
  assertFamilyVisible,
} from '@silvercare/contracts/src/generated/presentation';
import {
  validateTypographyScale,
  validateAccessibilityStandards,
  validateThemeTokens,
} from '../../apps/web/src/lib/ui-theme-validator';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: MDR-NO-PHYSIO-TO-FAMILY
 *
 * Testy wykonawcze dla kontraktu szablonu i spójności projektowej:
 * 1. Skala typograficzna i zakaz mikro-fontów (<14px).
 * 2. Standardy dostępności WCAG (cel dotykowy 38px (ADR-018), kontrast 4.5:1).
 * 3. Tokeny motywu jasnego i ciemnego oraz ochrona danych fizjologicznych.
 */
describe('Tokeny z kontraktu w motywie aplikacji (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it('kontrakt spełnia normę Mobile-First: tekst bazowy 16px, cel dotykowy 38px (ADR-018) @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(TYPOGRAPHY.baseSize).toBe('16px');
    expect(ACCESSIBILITY.touchTargetMinimum).toBe('38px');
    expect(ACCESSIBILITY.contrastMinimum).toBe(4.5);

    const typoResult = validateTypographyScale(TYPOGRAPHY);
    expect(typoResult.valid).toBe(true);
    expect(typoResult.violations).toEqual([]);

    const a11yResult = validateAccessibilityStandards(ACCESSIBILITY);
    expect(a11yResult.valid).toBe(true);
    expect(a11yResult.violations).toEqual([]);
  });

  it('posiada kompletną paletę tokenów motywu jasnego i ciemnego @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const lightResult = validateThemeTokens(COLORS.light as unknown as Record<string, { value: string }>);
    expect(lightResult.valid).toBe(true);
    expect(lightResult.missing).toEqual([]);

    const darkResult = validateThemeTokens(COLORS.dark as unknown as Record<string, { value: string }>);
    expect(darkResult.valid).toBe(true);
    expect(darkResult.missing).toEqual([]);

    expect(COLORS.light.accent.value).toBe('#2F6F5E');
    expect(COLORS.dark.accent.value).toBe('#7FBCA8');
  });

  it('definiuje spójną skalę odstępów (4px) i promieni zaokrągleń @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(SPACING.unit).toBe(4);
    expect(SPACING.scale.sm).toBe('8px');
    expect(SPACING.scale.md).toBe('16px');
    expect(RADIUS.full).toBe('999px');
    expect(ELEVATION.none).toBe('none');
    expect(MOTION.durations.fast).toBe('180ms');
  });
});

describe('Ochrona metryk fizjologicznych (@REQ: MDR-NO-PHYSIO-TO-FAMILY)', () => {
  it('prezentacja metryk rozdziela dane behawioralne od fizjologicznych @REQ: MDR-NO-PHYSIO-TO-FAMILY', () => {
    expect(FAMILY_VISIBLE_METRICS).toHaveLength(5);
    expect(PHYSIOLOGICAL_FIELDS).toHaveLength(12);

    for (const field of PHYSIOLOGICAL_FIELDS) {
      expect(() => assertFamilyVisible(field)).toThrow(/ADR-005/);
    }
  });
});
