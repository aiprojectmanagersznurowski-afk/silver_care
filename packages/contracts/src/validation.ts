/**
 * validation.ts — Post-generation guards for AI reports and speech notes.
 *
 * Implements acceptance criteria for:
 * - MDR-NO-INTERPRETATION (strict non-medical vocabulary, no health evaluations)
 * - VOICE-MEDICAL-STRIP (ensuring clinical data never enters family presentation)
 */

export type MedicationEvent = 'taken' | 'refused' | 'missed' | 'none';

/**
 * Zwraca zatwierdzony, deterministyczny szablon zdarzenia lekowego dla bliskich (bez nazw leków, dawek i liczb).
 */
export function resolveMedicationTemplate(event: MedicationEvent | string | null | undefined): string | null {
  switch (event) {
    case 'taken':
      return 'Podopieczny przyjął zaplanowane na dziś wsparcie zgodnie z harmonogramem dnia.';
    case 'refused':
      return 'Podopieczny odmówił przyjęcia zaplanowanej porcji wsparcia — personel odnotował ten fakt i otacza podopiecznego uważną opieką.';
    case 'missed':
      return 'Zaplanowana porcja wsparcia została pominięta w standardowym oknie czasowym — personel monitoruje harmonogram.';
    case 'none':
    default:
      return null;
  }
}

// Patterns derived from MDR_GUARDRAILS and forbidden clinical language
const CLINICAL_PATTERNS: Array<{ regex: RegExp; desc: string }> = [
  { regex: /czuje się słabiej/i, desc: 'forbidden: ocena kondycji ("czuje się słabiej")' },
  { regex: /kondycja się pogarsza/i, desc: 'forbidden: ocena pogorszenia kondycji' },
  { regex: /podejrzenie\s+(?:omdleni[a-ząćęłńóśźż]*|zawa[łl][a-ząćęłńóśźż]*|uda[rz][a-ząćęłńóśźż]*|infekcj[a-ząćęłńóśźż]*|chorob[a-ząćęłńóśźż]*)/i, desc: 'forbidden: podejrzenie jednostki chorobowej' },
  { regex: /możliwe\s+(?:odwodnieni[a-ząćęłńóśźż]*|zakażeni[a-ząćęłńóśźż]*)/i, desc: 'forbidden: sugestia kliniczna' },
  { regex: /początek\s+infekcj[a-ząćęłńóśźż]*/i, desc: 'forbidden: prognoza infekcji' },
  { regex: /diagnoz[a-ząćęłńóśźż]*/i, desc: 'forbidden: termin diagnoza' },
  { regex: /\bobjaw[a-ząćęłńóśźż]*(?![a-ząćęłńóśźż])/i, desc: 'forbidden: termin objaw kliniczny' },
  { regex: /\bterapi[a-ząćęłńóśźż]*(?![a-ząćęłńóśźż])/i, desc: 'forbidden: termin terapia medyczna' },
  { regex: /prawdopodobnie\s+choruje/i, desc: 'forbidden: ocena stanu chorobowego' },
  { regex: /stan\s+zdrowia\s+pogarsza/i, desc: 'forbidden: ocena stanu zdrowia' },
  { regex: /wskazuje\s+na\s+chorob/i, desc: 'forbidden: wnioskowanie chorobowe' },
  // Blokada ocen klinicznych (Non-MDR: normy, podwyższone/obniżone, prawidłowy poziom)
  { regex: /\b(?:w\s+normie|poza\s+norm[a-ząćęłńóśźż]*|poniżej\s+norm[a-ząćęłńóśźż]*|powyżej\s+norm[a-ząćęłńóśźż]*)(?![a-ząćęłńóśźż])/i, desc: 'forbidden: ocena parametru ("w normie / poza normą")' },
  { regex: /\bpodwyższon[a-ząćęłńóśźż]*(?![a-ząćęłńóśźż])/i, desc: 'forbidden: ocena parametru ("podwyższone")' },
  { regex: /\bobniżon[a-ząćęłńóśźż]*(?![a-ząćęłńóśźż])/i, desc: 'forbidden: ocena parametru ("obniżone")' },
  { regex: /\b(?:prawidłow|nieprawidłow)[a-ząćęłńóśźż]*\s+(?:poziom|wynik|parametr|ciśnieni[a-ząćęłńóśźż]*|stan|wartoś[ćc][a-ząćęłńóśźż]*)[a-ząćęłńóśźż]*(?![a-ząćęłńóśźż])/i, desc: 'forbidden: ocena wartościująca parametr' },
];

// Patterns for forbidden UI vocabulary (ADR-004)
const FORBIDDEN_VOCABULARY: Array<{ regex: RegExp; desc: string }> = [
  { regex: /\bpacjen[tc]\w*/i, desc: 'FORBIDDEN_UI_TERMS: zakazane słowo "pacjent"' },
  { regex: /\bpatient\w*/i, desc: 'FORBIDDEN_UI_TERMS: forbidden term "patient"' },
];

// Comprehensive clinical parameter patterns for REDACT pre-filtering (wycinanie całych fraz pomiarowych z liczbą i jednostką!)
const HARD_PARAMETER_PATTERNS: Array<{ regex: RegExp; desc: string }> = [
  // Ciśnienie tętnicze (z wartościami liczbowymi i "na" / "/")
  { regex: /(?:ciśnieni(?:e|a|u|em)?(?:\s+tętnicz(?:e|ego|emu|ym))?\s*(?:wynosiło|wynosi|to|:|=)?\s*)?\b\d{2,3}\s*(?:\/|\s+na\s+)\s*\d{2,3}(?:\s*mmHg)?\b/gi, desc: 'vital_sign: ciśnienie tętnicze' },
  // Saturacja SpO2 (cała fraza łącznie z procentem)
  { regex: /(?:saturacj(?:a|i|ę|ą|o|e)|spo2|sat\.?)\s*(?:wynosiła|wynosi|to|:|=)?\s*\d{1,3}\s*%(?:\s*SpO2)?|\b\d{1,3}\s*%\s*(?:SpO2|saturacj(?:a|i|ę|ą|o|e))\b/gi, desc: 'vital_sign: saturacja SpO2' },
  // Cukier / glikemia / glukoza (cała fraza z liczbą i jednostką, bez zostawiania samotnego 280)
  { regex: /(?:cukier(?:\s+we\s+krwi)?|glukoz[a-ząćęłńóśźż]*|glikemi[a-ząćęłńóśźż]*)\s*(?:wynosił|wynosiła|wynosi|to|:|=)?\s*\d{2,4}(?:\s*(?:mg\/dl|mg%|mmol\/l))?|\b\d{2,4}\s*(?:mg\/dl|mg%|mmol\/l)\s*(?:glukoz[a-ząćęłńóśźż]*|cukru|glikemi[a-ząćęłńóśźż]*)?\b/gi, desc: 'vital_sign: glikemia / cukier' },
  // Puls / tętno
  { regex: /(?:tętn(?:o|a|em|ie)|puls(?:u|em|ie)?|akcj(?:a|i|ę|ą)\s+serca)\s*(?:wynosiło|wynosił|wynosi|to|:|=)?\s*\d{2,3}(?:\s*(?:bpm|ud\/min|uderzeń(?:\s+na\s+minutę)?))?\b/gi, desc: 'vital_sign: tętno / puls' },
  // Temperatura ciała
  { regex: /(?:temperatur[a-ząćęłńóśźż]*|temp\.?|gorączk[a-ząćęłńóśźż]*)\s*(?:wynosiła|wynosi|to|:|=)?\s*\d{1,2}(?:[.,]\d+)?\s*(?:°C|C|stopn(?:i|ie|ia|iach))\b|\b\d{1,2}[.,]\d+\s*(?:°C|C|stopn(?:i|ie|ia|iach))\b/gi, desc: 'vital_sign: temperatura ciała' },
  // Dawki z jednostkami miary
  { regex: /\b\d+(?:[.,]\d+)?\s*(?:mg|miligram[a-ząćęłńóśźż]*|mcg|µg|ug|mikrogram[a-ząćęłńóśźż]*|g|gram[a-ząćęłńóśźż]*|ml|mililitr[a-ząćęłńóśźż]*|j\.?m\.?|jednost[a-ząćęłńóśźż]*|kropl[a-ząćęłńóśźż]*|saszet[a-ząćęłńóśźż]*|amp(?:uł[a-ząćęłńóśźż]*)?|tabletk[a-ząćęłńóśźż]*|kapsuł[a-ząćęłńóśźż]*)\b/gi, desc: 'medication: dawka lub forma leku' },
  // Leki połączone z dawką liczbową (np. Euthyrox 50 mikrogramów, Metformax 500 mg)
  { regex: /\b(?:metformax|metformin|euthyrox|letrox|captopril|bisocard|concor|acard|polocard|xarelto|pradaxa|eliquis|furosemid|toramide|kalipoz|ketrel|kwetiapin|haloperidol|relanium|hydroksyzyn|tramal|tramadol|paracetamol|apap|ibuprofen|nolpaza|controloc|helicid|clexane|neoparin|furagin|ketonal|morfin)[a-ząćęłńóśźż]*\s+\d+(?:[.,]\d+)?\s*(?:mg|miligram[a-ząćęłńóśźż]*|mcg|µg|ug|mikrogram[a-ząćęłńóśźż]*|g|gram[a-ząćęłńóśźż]*|ml|mililitr[a-ząćęłńóśźż]*|j\.?m\.?|jednost[a-ząćęłńóśźż]*|kropl[a-ząćęłńóśźż]*|saszet[a-ząćęłńóśźż]*|amp[a-ząćęłńóśźż]*|tabletk[a-ząćęłńóśźż]*|kapsuł[a-ząćęłńóśźż]*)?/gi, desc: 'medication: lek z dawką' },
];

// Medical categories markers for REDACT check (pełna fleksja polska z uwzględnieniem oboczności spółgłoskowych ł->l, r->rz, ć->ci)
const MEDICAL_DATA_PATTERNS: Array<{ regex: RegExp; desc: string }> = [
  // Leki, formy i dawki
  { regex: /\b(?:tabletk[a-ząćęłńóśźż]*|kapsuł[a-ząćęłńóśźż]*|kropl[a-ząćęłńóśźż]*|antybiotyk[a-ząćęłńóśźż]*|lek(?:i|ów|u|iem|ami|ach)?|dawk[a-ząćęłńóśźż]*|iniekcj[a-ząćęłńóśźż]*|zastrzyk[a-ząćęłńóśźż]*|wlew[a-ząćęłńóśźż]*|kroplówk[a-ząćęłńóśźż]*)(?![a-ząćęłńóśźż])/i, desc: 'medication: formy podania i leki' },
  { regex: /\b(?:metformax|metformin|euthyrox|letrox|captopril|bisocard|concor|acard|polocard|xarelto|pradaxa|eliquis|furosemid|toramide|kalipoz|ketrel|kwetiapin|haloperidol|relanium|hydroksyzyn|tramal|tramadol|paracetamol|apap|ibuprofen|nolpaza|controloc|helicid|clexane|neoparin|furagin|ketonal|morfin)[a-ząćęłńóśźż]*(?![a-ząćęłńóśźż])/i, desc: 'medication: nazwy leków senioralnych' },
  // Parametry życiowe i narządy
  { regex: /\b(?:ciśnieni[a-ząćęłńóśźż]*|saturacj[a-ząćęłńóśźż]*|tętn[oa]|puls[a-ząćęłńóśźż]*|ekg|cukier|glukoz[a-ząćęłńóśźż]*|glikemi[a-ząćęłńóśźż]*)(?![a-ząćęłńóśźż])/i, desc: 'vital_sign: parametry życiowe' },
  // Wyniki badań laboratoryjnych
  { regex: /\b(?:wynik[a-ząćęłńóśźż]*(?:\s+badań)?|mocznik[a-ząćęłńóśźż]*|kreatynin[a-ząćęłńóśźż]*|crp|morfologi[a-ząćęłńóśźż]*)(?![a-ząćęłńóśźż])/i, desc: 'test_result: wyniki badań laboratoryjnych' },
  // Jednostki chorobowe i stany kliniczne (pełna fleksja: insulinę, cukrzycę, zawał/zawale, udar/udarze, duszność/duszności, itp.)
  { regex: /\b(?:insulin[a-ząćęłńóśźż]*|cukrzyc[a-ząćęłńóśźż]*|nadciśnieni[a-ząćęłńóśźż]*|niedociśnieni[a-ząćęłńóśźż]*|(?:po\s+)?zawa[łl][a-ząćęłńóśźż]*|(?:po\s+)?uda[rz][a-ząćęłńóśźż]*|demencj[a-ząćęłńóśźż]*|alzheimer[a-ząćęłńóśźż]*|parkinson[a-ząćęłńóśźż]*|odleżyn[a-ząćęłńóśźż]*|gorączk[a-ząćęłńóśźż]*|duszno[sś][a-ząćęłńóśźż]*|arytmi[a-ząćęłńóśźż]*|migotani[a-ząćęłńóśźż]*|niewydolno[sś][a-ząćęłńóśźż]*|epilepsj[a-ząćęłńóśźż]*|padaczk[a-ząćęłńóśźż]*|nowotwor[a-ząćęłńóśźż]*|onkolog[a-ząćęłńóśźż]*|cewnik[a-ząćęłńóśźż]*|stomi[a-ząćęłńóśźż]*|zapaleni[a-ząćęłńóśźż]*\s+płuc|omdleni[a-ząćęłńóśźż]*|zakażeni[a-ząćęłńóśźż]*)(?![a-ząćęłńóśźż])/i, desc: 'diagnosis: stany kliniczne i choroby' },
  // Zalecenia lekarskie
  { regex: /\b(?:zalecen[a-ząćęłńóśźż]*\s+lekarsk[a-ząćęłńóśźż]*|konsultacj[a-ząćęłńóśźż]*\s+kardiologiczn[a-ząćęłńóśźż]*|zlecen[a-ząćęłńóśźż]*\s+lekarsk[a-ząćęłńóśźż]*)(?![a-ząćęłńóśźż])/i, desc: 'clinical_advice: zalecenia lekarskie' },
];

export interface ValidationResult {
  valid: boolean;
  violations: string[];
}

export interface MedicalCheckResult {
  hasMedical: boolean;
  found: string[];
}

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

  const allPatterns = [...HARD_PARAMETER_PATTERNS, ...MEDICAL_DATA_PATTERNS, ...CLINICAL_PATTERNS];
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

  // Najpierw usuwamy twarde parametry i frazy wielowyrazowe (np. "Euthyrox 50 mikrogramów", "saturacja 91%", "cukier 280")
  for (const item of HARD_PARAMETER_PATTERNS) {
    const flags = item.regex.flags.includes('g') ? item.regex.flags : item.regex.flags + 'g';
    const r = new RegExp(item.regex.source, flags);
    cleaned = cleaned.replace(r, '');
  }

  // Następnie pojedyncze słowa kluczowe leków i rozpoznań
  for (const item of MEDICAL_DATA_PATTERNS) {
    const flags = item.regex.flags.includes('g') ? item.regex.flags : item.regex.flags + 'g';
    const r = new RegExp(item.regex.source, flags);
    cleaned = cleaned.replace(r, '');
  }

  // Na koniec frazy oceny klinicznej
  for (const item of CLINICAL_PATTERNS) {
    const flags = item.regex.flags.includes('g') ? item.regex.flags : item.regex.flags + 'g';
    const r = new RegExp(item.regex.source, flags);
    cleaned = cleaned.replace(r, '');
  }

  // Uporządkuj białe znaki, wiszące przecinki i kropki
  return cleaned
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]*[,.]+[ \t]*/gm, '')
    .replace(/,[ \t]*,/g, ',')
    .replace(/\(\s*\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
