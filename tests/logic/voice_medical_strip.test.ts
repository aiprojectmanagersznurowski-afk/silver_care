import { describe, it, expect } from 'vitest'
import { redactVoiceTranscript } from '../../apps/web/src/lib/voice-redactor'
import { validateNoMedicalDataInReport } from '../../packages/contracts/src/validation'
import { MEDICAL_CATEGORIES } from '../../packages/contracts/src/generated/voice'
import { VOICE_PROCESSING_PROMPT } from '../../packages/contracts/src/prompts'

describe('VOICE-MEDICAL-STRIP Logic', () => {

  it('deterministycznie ekstrahuje i wycina parametry kliniczne (ciśnienie, dawki, saturacja, temperatura) przed LLM @REQ: VOICE-MEDICAL-STRIP', () => {
    const rawTranscript = 'Senior zjadł ze smakiem śniadanie. Ciśnienie tętnicze 140/90 mmHg, saturacja 92% SpO2, temperatura 38.5°C. Podano 500 mg Paracetamolu o 10:00. Po południu spacerował po ogrodzie.'

    const result = redactVoiceTranscript(rawTranscript)

    expect(result.hasMedicalData).toBe(true)
    expect(result.extractedMedical.length).toBeGreaterThanOrEqual(4)

    // Oczyszczony transkrypt nie zawiera twardych parametrów ani nazw leków
    expect(result.cleanedTranscript).not.toContain('140/90')
    expect(result.cleanedTranscript).not.toContain('38.5')
    expect(result.cleanedTranscript).not.toContain('500 mg')
    expect(result.cleanedTranscript).not.toContain('Paracetamol')

    // Zachowane zdarzenia behawioralne
    expect(result.cleanedTranscript).toContain('Senior zjadł ze smakiem śniadanie')
    expect(result.cleanedTranscript).toContain('Po południu spacerował po ogrodzie')

    // Weryfikacja braku danych medycznych w zredagowanym tekście
    const check = validateNoMedicalDataInReport(result.cleanedTranscript)
    expect(check.hasMedical).toBe(false)
  })

  it('maskuje numery PESEL, telefony oraz adresy e-mail przed przekazaniem do LLM @REQ: VOICE-MEDICAL-STRIP', () => {
    const rawTranscript = 'Kontakt z córką pod 600-100-200 lub anna@example.com. PESEL 85010112345. Pensjonariusz odpoczywał w pokoju.'

    const result = redactVoiceTranscript(rawTranscript)

    expect(result.hasPii).toBe(true)
    expect(result.cleanedTranscript).toContain('[PESEL ZAMASKOWANY]')
    expect(result.cleanedTranscript).toContain('[TELEFON ZAMASKOWANY]')
    expect(result.cleanedTranscript).toContain('[EMAIL ZAMASKOWANY]')

    expect(result.cleanedTranscript).not.toContain('85010112345')
    expect(result.cleanedTranscript).not.toContain('600-100-200')
    expect(result.cleanedTranscript).not.toContain('anna@example.com')
  })

  it('classifier prompt covers all categories from MEDICAL_CATEGORIES @REQ: VOICE-MEDICAL-STRIP', () => {
    for (const cat of MEDICAL_CATEGORIES) {
      expect(VOICE_PROCESSING_PROMPT.toLowerCase()).toContain(cat.id.toLowerCase())
    }
  })

  it('REDACT stage rejects texts containing medication names and clinical data @REQ: VOICE-MEDICAL-STRIP', () => {
    const medicalSamples = [
      'Podano 2 tabletki Furaginy o 14:00.',
      'Ciśnienie tętnicze 150/90, saturacja 92%.',
      'Wyniki badań krwi wskazują na podwyższony mocznik.',
      'Zalecenie lekarskie: konsultacja kardiologiczna.'
    ]

    for (const sample of medicalSamples) {
      const check = validateNoMedicalDataInReport(sample)
      expect(check.hasMedical).toBe(true)
    }

    const behavioralClean = 'Senior zjadł ze smakiem podwieczorek i wyszedł do ogrodu na krótki spacer.'
    const cleanCheck = validateNoMedicalDataInReport(behavioralClean)
    expect(cleanCheck.hasMedical).toBe(false)
  })

})
