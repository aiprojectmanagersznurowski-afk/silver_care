import { describe, it, expect } from 'vitest'
import {
  validateVoiceDraftInput,
  STAFF_REVIEW_FALLBACK_NOTICE,
  sanitizeReportAndVerifySafety,
} from '../../apps/web/src/lib/voice-redactor'
import { extractJson } from '../../apps/web/src/lib/voice-helpers'
import { ZERO_GUESSING_DIRECTIVE, FAMILY_REPORT_PROMPT } from '../../packages/contracts/src/prompts'

describe('VOICE-ZERO-GUESSING Logic', () => {

  it('waliduje i odrzuca brakujący resident_id na notatce bez prób zgadywania tożsamości @REQ: VOICE-ZERO-GUESSING', () => {
    // Brak notatki
    const noDraft = validateVoiceDraftInput(null)
    expect(noDraft.valid).toBe(false)
    expect(noDraft.error).toContain('Nie znaleziono notatki')

    // Brak resident_id
    const missingResident = validateVoiceDraftInput({ resident_id: null, transcript: 'Senior zjadł obiad.' })
    expect(missingResident.valid).toBe(false)
    expect(missingResident.error).toContain('Brak wymaganego identyfikatora resident_id na notatce')

    // Pusty identyfikator
    const emptyResident = validateVoiceDraftInput({ resident_id: '   ', transcript: 'Senior zjadł obiad.' })
    expect(emptyResident.valid).toBe(false)

    // Brak treści transkrypcji
    const emptyTranscript = validateVoiceDraftInput({ resident_id: '550e8400-e29b-41d4-a716-446655440000', transcript: '  ' })
    expect(emptyTranscript.valid).toBe(false)
    expect(emptyTranscript.error).toContain('Brak treści transkrypcji')

    // Poprawny szkic
    const validDraft = validateVoiceDraftInput({
      resident_id: '550e8400-e29b-41d4-a716-446655440000',
      transcript: 'Senior zjadł podwieczorek i wyszedł do ogrodu.',
    })
    expect(validDraft.valid).toBe(true)
  })

  it('obsługuje niejednoznaczne wejście i wyciąga followup_question bez zmyślania faktów @REQ: VOICE-ZERO-GUESSING', () => {
    const rawClassifierResponse = JSON.stringify({
      medical: null,
      discomfort: null,
      behavioral: null,
      followup_question: 'Czy podopieczny zjadł obiad i jak wyglądało popołudnie?',
    })

    const parsed = extractJson(rawClassifierResponse)
    expect(parsed.followup_question).toBe('Czy podopieczny zjadł obiad i jak wyglądało popołudnie?')
    expect(parsed.behavioral).toBeNull()
    expect(parsed.medical).toBeNull()
  })

  it('blokuje fabrykację w fallbacku guardraila i nie generuje tekstu o spokojnym dniu @REQ: VOICE-ZERO-GUESSING', () => {
    // Odpowiedź LLM naruszająca guardrail (zawiera zabronione rozpoznanie medyczne)
    const violatingReport = 'Nasz podopieczny czuje się słabiej, podejrzewamy omdlenie i infekcję dróg moczowych.'

    const result = sanitizeReportAndVerifySafety(violatingReport)

    // Guardrail blokuje i wymusza weryfikację personelu
    expect(result.requiresStaffReview).toBe(true)
    expect(result.reportText).toContain(STAFF_REVIEW_FALLBACK_NOTICE)

    // ZERO FABRICATION: zakaz wstawiania zmyślonego tekstu o spokojnym dniu
    expect(result.reportText).not.toContain('spokojny dzień')
    expect(result.reportText).not.toContain('spędził dzisiaj spokojny dzień')
  })

  it('contracts prompt exports ZERO_GUESSING_DIRECTIVE and forbids identity guessing @REQ: VOICE-ZERO-GUESSING', () => {
    expect(ZERO_GUESSING_DIRECTIVE).toBeDefined()
    expect(ZERO_GUESSING_DIRECTIVE).toMatch(/never guess/i)
    expect(ZERO_GUESSING_DIRECTIVE).toMatch(/identity/i)

    // Family report prompt zabrania zgadywania imienia pensjonariusza
    expect(FAMILY_REPORT_PROMPT).toMatch(/never guess identity|nigdy nie zgaduj tożsamości|anonimow/i)
  })

})
