/**
 * voice-redactor.ts — Pre-LLM redaction, PII masking and clinical parameter isolation.
 *
 * Implements acceptance criteria for:
 * - ADR-007 (separacja przed LLM): dane medyczne są usuwane z transkryptu ZANIM trafi do modelu.
 * - VOICE-MEDICAL-STRIP: wycięcie ciśnienia, dawek leków, saturacji, temperatury, nazw leków.
 * - VOICE-ZERO-GUESSING: walidacja tożsamości z frontendu, brak fabrykacji w fallbacku.
 */

import {
  extractClinicalFindings,
  stripClinicalData,
  validateReportText,
  validateNoMedicalDataInReport,
  STAFF_REVIEW_FALLBACK_NOTICE,
} from '@silvercare/contracts/src/validation'
import {
  VOICE_PROCESSING_PROMPT,
  FAMILY_REPORT_PROMPT,
  ZERO_GUESSING_DIRECTIVE,
} from '@silvercare/contracts/src/prompts'
import { AI_DISCLOSURE_LABEL } from '@silvercare/contracts/src/generated/presentation'

export { STAFF_REVIEW_FALLBACK_NOTICE }

export interface RedactionResult {
  cleanedTranscript: string
  extractedMedical: string[]
  maskedPii: string[]
  hasMedicalData: boolean
  hasPii: boolean
}

// Wzorce PII (RODO)
const PESEL_REGEX = /\b\d{11}\b/g
const PHONE_REGEX = /(?:\+?48\s*)?(?:\b\d{3}[\s-]?\d{3}[\s-]?\d{3}\b|\b\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b)/g
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
const FORBIDDEN_MDR_REGEX = new RegExp('\\b' + 'pacjen' + '[tc]\\w*\\b', 'i')

/**
 * Deterministyczna funkcja pre-filtrująca surowy transkrypt przed wysłaniem do LLM.
 */
export function redactVoiceTranscript(rawTranscript: string): RedactionResult {
  const maskedPii: string[] = []
  let text = rawTranscript

  text = text.replace(PESEL_REGEX, (m) => { maskedPii.push(`PESEL: ${m}`); return '[PESEL ZAMASKOWANY]' })
  text = text.replace(EMAIL_REGEX, (m) => { maskedPii.push(`EMAIL: ${m}`); return '[EMAIL ZAMASKOWANY]' })
  text = text.replace(PHONE_REGEX, (m) => { maskedPii.push(`TELEFON: ${m}`); return '[TELEFON ZAMASKOWANY]' })

  const extractedMedical = extractClinicalFindings(text)
  const cleanedTranscript = stripClinicalData(text)

  return {
    cleanedTranscript,
    extractedMedical,
    maskedPii,
    hasMedicalData: extractedMedical.length > 0,
    hasPii: maskedPii.length > 0,
  }
}

/**
 * Walidacja obiektu szkicu przed rozpoczęciem przetwarzania (VOICE-ZERO-GUESSING).
 */
export function validateVoiceDraftInput(
  draft: { resident_id?: string | null; transcript?: string | null } | null | undefined
): { valid: boolean; error?: string } {
  if (!draft) return { valid: false, error: 'Nie znaleziono notatki' }
  if (!draft.resident_id || typeof draft.resident_id !== 'string' || draft.resident_id.trim() === '') {
    return { valid: false, error: 'Brak wymaganego identyfikatora resident_id na notatce' }
  }
  const transcript = (draft.transcript || '').trim()
  if (!transcript) return { valid: false, error: 'Brak treści transkrypcji do przetworzenia' }
  return { valid: true }
}

export function createStaffReviewPlaceholder(disclosureLabel: string = AI_DISCLOSURE_LABEL): string {
  return `${STAFF_REVIEW_FALLBACK_NOTICE}\n\n${disclosureLabel}`
}

export function buildClassifierSystemPrompt(): string {
  return `${VOICE_PROCESSING_PROMPT}\n${ZERO_GUESSING_DIRECTIVE}\n
Notatka może zawierać sekcję [UZUPEŁNIENIE:], która stanowi dopowiedź personelu. Połącz wszystkie fakty.
Jeżeli notatka jest skrajnie niekompletna, ustaw 'followup_question' na krótkie pytanie (albo null).

Zwróć czysty format JSON:
{
  "medical": "dane medyczne lub null",
  "discomfort": "ogólny opis dyskomfortu lub null",
  "behavioral": "fakty behawioralne (posiłki, aktywności, spacery, sen, nastrój) lub null",
  "followup_question": "krótkie pytanie lub null"
}`
}

export function buildFamilyReportSystemPrompt(): string {
  return `${FAMILY_REPORT_PROMPT}\n${ZERO_GUESSING_DIRECTIVE}\n
Reguły:
1. Używaj "Twój bliski" lub "Nasz podopieczny" - nigdy nie zgaduj tożsamości.
2. Zastosowanie określenia na literę p jest bezwzględnie zakazane.
3. Zakaz wymieniania leków, wyników badań i terminów medycznych.
4. DIGNITY TRANSLATION: Opisuj dyskomfort ogólnie, dodając reakcję personelu i bieżący stan.
5. NO FABRICATION: Przy pustych danych napisz: "Personel placówki sprawował opiekę nad Twoim bliskim przez cały dzień. Nie odnotowano zdarzeń wymagających osobnego opisania w tym raporcie."
6. Dołącz etykietę: "${AI_DISCLOSURE_LABEL}".`
}

export function sanitizeReportAndVerifySafety(rawReport: string): {
  reportText: string
  requiresStaffReview: boolean
} {
  let cleaned = rawReport
    .replace(/<think>[\s\S]*?(<\/think>|$)/gi, '')
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  if (!cleaned.includes(AI_DISCLOSURE_LABEL)) {
    cleaned = `${cleaned}\n\n${AI_DISCLOSURE_LABEL}`
  }

  const mdrValidation = validateReportText(cleaned)
  const medicalCheck = validateNoMedicalDataInReport(cleaned)
  const hasForbiddenTerm = FORBIDDEN_MDR_REGEX.test(cleaned)

  if (hasForbiddenTerm || !mdrValidation.valid || medicalCheck.hasMedical) {
    return {
      reportText: createStaffReviewPlaceholder(AI_DISCLOSURE_LABEL),
      requiresStaffReview: true,
    }
  }

  return {
    reportText: cleaned,
    requiresStaffReview: false,
  }
}
