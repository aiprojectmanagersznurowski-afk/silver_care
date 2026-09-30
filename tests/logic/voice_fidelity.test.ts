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
    // Upewnijmy się, że przy braku jakiegokolwiek poprawnego klucza funkcja rzuca błąd zamiast generować zmyślone raporty
    const origKey = process.env.EU_LLM_API_KEY
    const origMistralKey = process.env.MISTRAL_API_KEY
    const origGroqKey = process.env.GROQ_API_KEY

    try {
      delete process.env.EU_LLM_API_KEY
      delete process.env.MISTRAL_API_KEY
      delete process.env.GROQ_API_KEY

      await expect(
        callEuLlmCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toThrow(/EU-LLM-CONFIG/)
    } finally {
      if (origKey) process.env.EU_LLM_API_KEY = origKey
      if (origMistralKey) process.env.MISTRAL_API_KEY = origMistralKey
      if (origGroqKey) process.env.GROQ_API_KEY = origGroqKey
    }
  })

  it.each([
    ['Groq', 'test_groq_key', 'GROQ_API_KEY'],
    ['xAI', 'xai-test-key-12345', 'XAI_API_KEY'],
  ])('callEuLlmCompletion refuses and makes no network call when only a %s key is present @REQ: INFRA-EU-REGION @REQ: INFRA-GROQ-TRANSCRIPTION', async (_name, key, envName) => {
    const saved = ['EU_LLM_API_KEY', 'MISTRAL_API_KEY', 'GROQ_API_KEY', 'XAI_API_KEY', 'EU_LLM_ENDPOINT'].map(
      (k) => [k, process.env[k]] as const
    )
    const originalFetch = globalThis.fetch
    let fetchCalls = 0

    try {
      for (const [k] of saved) delete process.env[k]
      process.env[envName] = key

      globalThis.fetch = (async () => {
        fetchCalls++
        return { ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }] }) } as any
      }) as any

      await expect(
        callEuLlmCompletion([{ role: 'user', content: 'Test prompt' }])
      ).rejects.toThrow(/EU-LLM-CONFIG/)
      expect(fetchCalls).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
      for (const [k, v] of saved) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
    }
  })

  it.each([
    'https://api.groq.com/openai/v1/chat/completions',
    'https://api.x.ai/v1/chat/completions',
    'https://api.openai.com/v1/chat/completions',
  ])('callEuLlmCompletion rejects non-EEA endpoint %s without sending the prompt @REQ: INFRA-EU-REGION', async (endpoint) => {
    const saved = ['EU_LLM_API_KEY', 'MISTRAL_API_KEY', 'EU_LLM_ENDPOINT'].map(
      (k) => [k, process.env[k]] as const
    )
    const originalFetch = globalThis.fetch
    let fetchCalls = 0

    try {
      process.env.EU_LLM_API_KEY = 'test_eu_key'
      process.env.EU_LLM_ENDPOINT = endpoint

      globalThis.fetch = (async () => {
        fetchCalls++
        return { ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }] }) } as any
      }) as any

      await expect(
        callEuLlmCompletion([{ role: 'user', content: 'Test prompt' }])
      ).rejects.toThrow(/EU-LLM-REGION/)
      expect(fetchCalls).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
      for (const [k, v] of saved) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
    }
  })
})
