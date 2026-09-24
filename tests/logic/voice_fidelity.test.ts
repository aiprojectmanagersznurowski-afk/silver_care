import { describe, it, expect } from 'vitest'
import { extractJson } from '../../apps/web/src/lib/voice-helpers'
import { callEuLlmCompletion } from '../../apps/web/src/lib/eu-llm-client'

describe('Voice Fidelity & Medical Stripping (VOICE-MEDICAL-STRIP, VOICE-ZERO-GUESSING, INFRA-EU-REGION)', () => {
  it('extractJson flags parse error and sets behavioral to null when JSON is corrupt @REQ: VOICE-MEDICAL-STRIP', () => {
    // Symulacja: surowy transkrypt zawierał nazwy leków, a LLM zwrócił ucięty/uszkodzony JSON
    const rawBrokenResponse = 'Podano Metformin 500mg oraz Enarenal. { niepoprawny json...'
    const fallbackText = 'Podano Metformin 500mg oraz Enarenal.'

    const result = extractJson(rawBrokenResponse, fallbackText)

    // ADR-007: Surowy tekst nie może wyciec do strumienia behawioralnego dla rodziny
    expect(result._parseError).toBe(true)
    expect(result.behavioral).toBeNull()
    expect(result.medical).toBeNull()
    expect(result.discomfort).toBeNull()
  })

  it('extractJson properly extracts valid streams from JSON without error @REQ: VOICE-ZERO-GUESSING', () => {
    const validResponse = JSON.stringify({
      medical: 'Parametry w normie',
      discomfort: 'Lekkie zmęczenie po obiedzie',
      behavioral: 'Uczestnictwo w warsztatach plastycznych, spacer w ogrodzie',
      followup_question: null,
    })

    const result = extractJson(validResponse, '')

    expect(result._parseError).toBeUndefined()
    expect(result.behavioral).toBe('Uczestnictwo w warsztatach plastycznych, spacer w ogrodzie')
    expect(result.discomfort).toBe('Lekkie zmęczenie po obiedzie')
    expect(result.medical).toBe('Parametry w normie')
  })

  it('callEuLlmCompletion rejects silent mocking when API key is missing @REQ: INFRA-EU-REGION', async () => {
    // Upewnijmy się, że przy braku poprawnego klucza funkcja rzuca błąd zamiast generować zmyślone raporty
    const origKey = process.env.EU_LLM_API_KEY
    const origMistralKey = process.env.MISTRAL_API_KEY

    try {
      delete process.env.EU_LLM_API_KEY
      delete process.env.MISTRAL_API_KEY

      await expect(
        callEuLlmCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toThrow(/EU-LLM-CONFIG/)
    } finally {
      if (origKey) process.env.EU_LLM_API_KEY = origKey
      if (origMistralKey) process.env.MISTRAL_API_KEY = origMistralKey
    }
  })
})
