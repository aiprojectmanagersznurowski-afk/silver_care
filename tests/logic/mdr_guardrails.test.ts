import { describe, it, expect } from 'vitest';
import {
  validateReportText,
  validateNoMedicalDataInReport,
  STAFF_REVIEW_FALLBACK_NOTICE,
} from '../../packages/contracts/src/validation';
import { AI_DISCLOSURE_LABEL } from '../../packages/contracts/src/generated/presentation';

describe('MDR Guardrails & Non-Medical Presentation Logic', () => {
  it('rejects forbidden clinical statements in report text @REQ: MDR-NO-INTERPRETATION', () => {
    // Statements forbidden by MDR_GUARDRAILS
    const badStatements = [
      'Senior czuje się słabiej niż wczoraj.',
      'Kondycja się pogarsza, senior nie wstawał z łóżka.',
      'Występuje podejrzenie omdlenia w godzinach porannych.',
      'Możliwe odwodnienie po spacerze.',
      'Może to oznaczać początek infekcji gardła.',
      'Postawiono wstępną diagnozę zapalenia płuc.',
      'Zaobserwowano niepokojący objaw kliniczny.',
      'Zalecana terapia farmakologiczna.'
    ];

    for (const statement of badStatements) {
      const result = validateReportText(statement);
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    }
  });

  it('rejects forbidden patient vocabulary in report text @REQ: MDR-NO-INTERPRETATION', () => {
    const patientVariants = [
      'Nasz pacjent miał dzisiaj spokojny dzień.',
      'Podano posiłek dla pacjenta.',
      'Rozmawiano o pacjencie z personelem.',
      'Nowy patient przyjęty do pokoju.'
    ];

    for (const text of patientVariants) {
      const result = validateReportText(text);
      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.includes('pacjent') || v.includes('patient') || v.includes('FORBIDDEN_UI_TERMS'))).toBe(true);
    }
  });

  it('accepts objective behavioral descriptions @REQ: MDR-NO-INTERPRETATION', () => {
    const validText = `Twój bliski uczestniczył dzisiaj w spacerze w ogrodzie i zjadł cały obiad. Popołudnie spędził na czytaniu prasy w świetlicy. Spał spokojnie 7 godzin i 20 minut.\n\n${AI_DISCLOSURE_LABEL}`;
    const result = validateReportText(validText);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('rejects clinical parameters and medications from entering family presentation @REQ: MDR-NO-INTERPRETATION', () => {
    const clinicalText = 'Podano 500mg paracetamolu, ciśnienie tętnicze 140/90, tętno 85.';
    const medicalCheck = validateNoMedicalDataInReport(clinicalText);
    expect(medicalCheck.hasMedical).toBe(true);
    expect(medicalCheck.found.length).toBeGreaterThan(0);

    // Fallback personelu nie zawiera zakazanego słownictwa
    const fallbackValidation = validateReportText(STAFF_REVIEW_FALLBACK_NOTICE);
    expect(fallbackValidation.valid).toBe(true);
    expect(fallbackValidation.violations).toHaveLength(0);
  });
});
