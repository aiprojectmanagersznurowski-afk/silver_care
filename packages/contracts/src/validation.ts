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

// Comprehensive clinical parameter patterns for REDACT pre-filtering
const HARD_PARAMETER_PATTERNS: Array<{ regex: RegExp; desc: string }> = [
  { regex: /(?:ciśnienie(?:\s+tętnicze)?\s*(?:wynosiło|to|:)?\s*)?\b\d{2,3}\s*\/\s*\d{2,3}(?:\s*mmHg)?\b/gi, desc: 'vital_sign: ciśnienie tętnicze' },
  { regex: /(?:saturacja|spo2|sat\.?)\s*(?:wynosiła|to|:)?\s*\d{1,3}\s*%(?:\s*SpO2)?\b|\b\d{1,3}\s*%\s*(?:SpO2|saturacj[a-z]*)\b/gi, desc: 'vital_sign: saturacja SpO2' },
  { regex: /(?:temperatura|temp\.?|gorączka)\s*(?:wynosiła|to|:)?\s*\d{1,2}(?:[.,]\d+)?\s*(?:°C|C|stopn(?:i|ie|ia|iach))\b|\b\d{1,2}[.,]\d+\s*(?:°C|C|stopn(?:i|ie|ia|iach))\b/gi, desc: 'vital_sign: temperatura ciała' },
  { regex: /\b\d+(?:[.,]\d+)?\s*(?:mg|miligram(?:ów|y)?|g|gram(?:ów|y)?|ml|mililitr(?:ów|y)?|tabletk[a-zęó]*|kapsuł[a-zęó]*)\b/gi, desc: 'medication: dawka lub forma leku' },
  { regex: /\b(furagin[a-z]*|paracetamol[a-z]*|ibuprofen[a-z]*|apap[a-z]*|ketonal[a-z]*|relanium|tramadol|morfin[a-z]*)\b/gi, desc: 'medication: nazwy leków' },
  { regex: /\b(zawał[a-z]*|udar[a-z]*|omdleni[ea]|zakażeni[ea])\b/gi, desc: 'diagnosis: alarmy kliniczne' },
];

export const STAFF_REVIEW_FALLBACK_NOTICE = '[Szkic wymaga weryfikacji personelu: automatyczny raport zawierał zastrzeżone sformułowania lub parametry medyczne]';

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

  for (const item of HARD_PARAMETER_PATTERNS) {
    const r = new RegExp(item.regex.source, item.regex.flags);
    if (r.test(text)) {
      found.push(item.desc);
    }
  }

  return {
    hasMedical: found.length > 0,
    found,
  };
}

/**
 * Ekstrahuje wszystkie parametry medyczne, dawki i rozpoznania z tekstu
 * do strumienia wewnętrznego personelu (daily_logs.medical).
 */
export function extractClinicalFindings(text: string): string[] {
  const findings: string[] = [];

  const allPatterns = [...CLINICAL_PATTERNS, ...MEDICAL_DATA_PATTERNS, ...HARD_PARAMETER_PATTERNS];
  for (const item of allPatterns) {
    const flags = item.regex.flags.includes('g') ? item.regex.flags : item.regex.flags + 'g';
    const r = new RegExp(item.regex.source, flags);
    let m: RegExpExecArray | null;
    while ((m = r.exec(text)) !== null) {
      const matchText = m[0].trim();
      if (matchText && !findings.includes(matchText)) {
        findings.push(matchText);
      }
      if (m.index === r.lastIndex) {
        r.lastIndex++;
      }
    }
  }

  return findings;
}

/**
 * Deterministycznie usuwa dane kliniczne, parametry i leki z tekstu,
 * aby do LLM trafił zredagowany tekst bez danych medycznych (ADR-007).
 */
export function stripClinicalData(text: string): string {
  let cleaned = text;

  const allPatterns = [...HARD_PARAMETER_PATTERNS, ...MEDICAL_DATA_PATTERNS, ...CLINICAL_PATTERNS];
  for (const item of allPatterns) {
    const flags = item.regex.flags.includes('g') ? item.regex.flags : item.regex.flags + 'g';
    const r = new RegExp(item.regex.source, flags);
    cleaned = cleaned.replace(r, '');
  }

  // Uporządkuj białe znaki i wiszące przecinki
  return cleaned
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]*,[ \t]*/gm, '')
    .replace(/,[ \t]*,/g, ',')
    .replace(/\(\s*\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
