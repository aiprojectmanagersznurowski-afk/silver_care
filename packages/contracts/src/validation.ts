/**
 * validation.ts — Post-generation guards for AI reports and speech notes.
 *
 * Implements acceptance criteria for:
 * - MDR-NO-INTERPRETATION (strict non-medical vocabulary, no health evaluations)
 * - VOICE-MEDICAL-STRIP (ensuring clinical data never enters family presentation)
 */

import { MDR_GUARDRAILS, FORBIDDEN_UI_TERMS } from './generated/presentation';
import { MEDICAL_CATEGORIES } from './generated/voice';

// Patterns derived from MDR_GUARDRAILS and forbidden clinical language
const CLINICAL_PATTERNS: Array<{ regex: RegExp; desc: string }> = [
  { regex: /czuje się słabiej/i, desc: 'forbidden: ocena kondycji ("czuje się słabiej")' },
  { regex: /kondycja się pogarsza/i, desc: 'forbidden: ocena pogorszenia kondycji' },
  { regex: /podejrzenie\s+(omdlenia|zawału|udaru|infekcji|choroby)/i, desc: 'forbidden: podejrzenie jednostki chorobowej' },
  { regex: /możliwe\s+(odwodnienie|zakażenie)/i, desc: 'forbidden: sugestia kliniczna' },
  { regex: /początek\s+infekcji/i, desc: 'forbidden: prognoza infekcji' },
  { regex: /diagnoz/i, desc: 'forbidden: termin diagnoza' },
  { regex: /\bobjaw[yu]?\b/i, desc: 'forbidden: termin objaw kliniczny' },
  { regex: /\bterapi[iaeyęoą]/i, desc: 'forbidden: termin terapia medyczna' },
  { regex: /prawdopodobnie\s+choruje/i, desc: 'forbidden: ocena stanu chorobowego' },
  { regex: /stan\s+zdrowia\s+pogarsza/i, desc: 'forbidden: ocena stanu zdrowia' },
  { regex: /wskazuje\s+na\s+chorob/i, desc: 'forbidden: wnioskowanie chorobowe' },
];

// Patterns for forbidden UI vocabulary (ADR-004)
const FORBIDDEN_VOCABULARY: Array<{ regex: RegExp; desc: string }> = [
  { regex: /\bpacjen[tc]\w*/i, desc: 'FORBIDDEN_UI_TERMS: zakazane słowo "pacjent"' },
  { regex: /\bpatient\w*/i, desc: 'FORBIDDEN_UI_TERMS: forbidden term "patient"' },
];

// Medical categories markers for REDACT check
const MEDICAL_DATA_PATTERNS: Array<{ regex: RegExp; desc: string }> = [
  { regex: /\b(tablet[ek|ki|ek]|furagin[a-z]*|paracetamol|ibuprofen|antybiotyk|lek[uów]?|dawk[iaę]|mg|kropl[ie])\b/i, desc: 'medication: nazwy leków, dawki' },
  { regex: /\b(ciśnienie\s+tętnicze|\bciśnieni[ea]\b|saturacj[a-z]*|tętn[oa]|ekg|cukier\s+we\s+krwi|glukoz[a-z]*)\b/i, desc: 'vital_sign: parametry życiowe' },
  { regex: /\b(wynik[i|ów]?\s+badań|mocznik|kreatynin[a-z]*|crp|morfologi[a-z]*)\b/i, desc: 'test_result: wyniki badań laboratoryjnych' },
  { regex: /\b(rozpoznani[ea]|zapaleni[ea]\s+płuc|niewydolność)\b/i, desc: 'diagnosis: jednostki chorobowe' },
  { regex: /\b(zaleceni[ea]\s+lekarski[e|ch]|konsultacj[a-z]*\s+kardiologiczn[a-z]*|zlecenie\s+lekarskie)\b/i, desc: 'clinical_advice: zalecenia lekarskie' },
];

export interface ValidationResult {
  valid: boolean;
  violations: string[];
}

export interface MedicalCheckResult {
  hasMedical: boolean;
  found: string[];
}

/**
 * Validates generated report text against MDR requirements and forbidden vocabulary.
 */
export function validateReportText(text: string): ValidationResult {
  const violations: string[] = [];

  for (const item of CLINICAL_PATTERNS) {
    if (item.regex.test(text)) {
      violations.push(item.desc);
    }
  }

  for (const item of FORBIDDEN_VOCABULARY) {
    if (item.regex.test(text)) {
      violations.push(item.desc);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Checks whether text contains any clinical/medical data that must be stripped
 * before reaching the family report generator.
 */
export function validateNoMedicalDataInReport(text: string): MedicalCheckResult {
  const found: string[] = [];

  for (const item of MEDICAL_DATA_PATTERNS) {
    if (item.regex.test(text)) {
      found.push(item.desc);
    }
  }

  return {
    hasMedical: found.length > 0,
    found,
  };
}
