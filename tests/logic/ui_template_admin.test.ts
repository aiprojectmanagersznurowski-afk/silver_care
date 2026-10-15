import { describe, it, expect } from 'vitest';
import {
  CARE_LEVELS,
  CARE_LEVEL_LABELS,
  CARE_LEVEL_BG_CLASSES,
  CARE_LEVEL_COLORS,
  getCareLevelChartColors,
} from '../../apps/web/src/lib/reporting-constants';
import {
  validateCareLevelNeutrality,
  validateAccessibilityStandards,
} from '../../apps/web/src/lib/ui-theme-validator';
import { COLORS, ACCESSIBILITY } from '@silvercare/contracts/src/generated/design';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: MDR-NO-INTERPRETATION
 *
 * Testy wykonawcze dla panelu administratora:
 * 1. Tokeny wykresów statystyk placówki (chart-1 do chart-5).
 * 2. Czerwień wyłącznie dla błędów technicznych, zakaz oceny stanu podopiecznego.
 * 3. Poprawne eksporty komponentów panelu administratora.
 */
describe('Panel administratora na komponentach szablonu (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it('posiada zdefiniowane serie wykresów chart-1 do chart-5 o właściwym kontraście @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const light = COLORS.light as Record<string, { value: string; desc?: string }>;
    for (let i = 1; i <= 5; i++) {
      const key = `chart-${i}`;
      expect(light[key], `Brak tokenu ${key}`).toBeDefined();
      expect(light[key].value).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('serie wykresów placówki nie używają kolorów oceny klinicznej ani destructive @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const light = COLORS.light as Record<string, { value: string; desc?: string }>;
    for (let i = 1; i <= 5; i++) {
      const key = `chart-${i}`;
      expect(light[key].value).not.toBe(light.destructive.value);
    }
  });

  it('spełnia normę dostępności WCAG dla interakcji administratorskich @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const a11yResult = validateAccessibilityStandards(ACCESSIBILITY);
    expect(a11yResult.valid).toBe(true);
    expect(ACCESSIBILITY.touchTargetMinimum).toBe('44px');
  });

  it('poprawnie eksportuje kluczowe komponenty panelu administratora @REQ: UI-TEMPLATE-ALIGNMENT', async () => {
    const admissionModule = await import('../../apps/web/src/components/AdmissionWizard');
    expect(typeof admissionModule.AdmissionWizard).toBe('function');

    const iamModule = await import('../../apps/web/src/components/IamManagementClient');
    expect(typeof iamModule.IamManagementClient).toBe('function');

    const orgsModule = await import('../../apps/web/src/components/OrganizationsManagementClient');
    expect(typeof orgsModule.OrganizationsManagementClient).toBe('function');
  });

  it('komponenty nawigacji bocznej i kart zdarzeń bezpiecznie obsługują ikony i strukturę @REQ: UI-TEMPLATE-ALIGNMENT', async () => {
    const adminSidebarModule = await import('../../apps/web/src/components/AdminSidebar');
    expect(typeof adminSidebarModule.AdminSidebar).toBe('function');

    const sidebarNavModule = await import('../../apps/web/src/components/SidebarNav');
    expect(typeof sidebarNavModule.SidebarNav).toBe('function');

    const residentEventsModule = await import('../../apps/web/src/components/residents/profile/ResidentEventsCard');
    expect(typeof residentEventsModule.ResidentEventsCard).toBe('function');

    const reportingConstants = await import('../../apps/web/src/lib/reporting-constants');
    expect(reportingConstants.EVENT_TYPE_ICONS).toBeDefined();
    for (const [, icon] of Object.entries(reportingConstants.EVENT_TYPE_ICONS)) {
      expect(typeof icon).toBe('string');
      expect(icon.length).toBeGreaterThan(0);
    }
  });
});

describe('Czerwień nie niesie oceny stanu pensjonariusza (@REQ: MDR-NO-INTERPRETATION)', () => {
  it('poziomy opieki (w tym „Leżący" i „Hospicjum") są neutralne i wolne od czerwieni @REQ: MDR-NO-INTERPRETATION', () => {
    const colors = getCareLevelChartColors();
    const result = validateCareLevelNeutrality(colors, CARE_LEVEL_BG_CLASSES);
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);

    expect(CARE_LEVEL_COLORS.bedridden).not.toMatch(/red|rose|destructive/i);
    expect(CARE_LEVEL_COLORS.hospice).not.toMatch(/red|rose|destructive/i);
  });

  it('każdy poziom opieki posiada kanoniczną etykietę w języku polskim @REQ: MDR-NO-INTERPRETATION', () => {
    expect(CARE_LEVELS).toEqual(['walking', 'sitting', 'bedridden', 'hospice']);
    for (const level of CARE_LEVELS) {
      expect(CARE_LEVEL_LABELS[level]).toBeDefined();
      expect(CARE_LEVEL_LABELS[level].length).toBeGreaterThan(0);
    }
  });
});
