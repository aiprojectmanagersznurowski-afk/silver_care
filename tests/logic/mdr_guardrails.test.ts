import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { validateReportText } from '../../packages/contracts/src/validation';
import { AI_DISCLOSURE_LABEL, MDR_GUARDRAILS, FORBIDDEN_UI_TERMS } from '../../packages/contracts/src/generated/presentation';

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

  it('verifies that process/route.ts includes post-generation validation and AI_DISCLOSURE_LABEL @REQ: MDR-NO-INTERPRETATION', () => {
    const routePath = path.resolve(__dirname, '../../apps/web/src/app/api/voice/process/route.ts');
    const content = fs.readFileSync(routePath, 'utf8');

    expect(content).toContain('validateReportText');
    expect(content).toContain('AI_DISCLOSURE_LABEL');
  });

});
