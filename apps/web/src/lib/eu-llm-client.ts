/**
 * Klient modeli językowych hostowanych w Europejskim Obszarze Gospodarczym (EOG)
 * Zgodność z ADR-009 oraz wymaganiem INFRA-EU-REGION / INFRA-GROQ-TRANSCRIPTION:
 * Klasyfikacja strumieni i generowanie raportu dla bliskich odbywają się w EOG.
 */

export interface EuLlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface EuLlmConfig {
  endpoint: string
  apiKey: string
  model: string
  region: 'EU'
}

export function getEuLlmConfig(): EuLlmConfig {
  // Domyślny dostawca europejski: Mistral AI (Francja / UE) lub dedykowany gateway EU
  const endpoint = process.env.EU_LLM_ENDPOINT || 'https://api.mistral.ai/v1/chat/completions'
  const apiKey = process.env.EU_LLM_API_KEY || process.env.MISTRAL_API_KEY || 'mock_eu_llm_key'
  const model = process.env.EU_LLM_MODEL || 'mistral-small-latest'

  return {
    endpoint,
    apiKey,
    model,
    region: 'EU',
  }
}

export async function callEuLlmCompletion(
  messages: EuLlmMessage[],
  temperature: number = 0.1,
  maxTokens: number = 600
): Promise<string> {
  const config = getEuLlmConfig()

  // Weryfikacja suwerenności danych EOG (zgodność z ADR-009)
  if (!config.endpoint.includes('.mistral.ai') && !config.endpoint.includes('eu-') && !config.endpoint.includes('europe')) {
    // Akceptujemy również lokalny mock deweloperski
    if (!config.endpoint.startsWith('http://localhost') && !config.endpoint.startsWith('http://127.0.0.1')) {
      console.warn(`[INFRA-EU-REGION] Ostrzeżenie: Endpoint ${config.endpoint} powinien znajdować się w strefie UE.`)
    }
  }

  // Weryfikacja konfiguracji klucza — brak cichego mockowania
  if (!config.apiKey || config.apiKey === 'mock_eu_llm_key') {
    throw new Error(
      '[EU-LLM-CONFIG] Brak skonfigurowanego klucza API europejskiego modelu LLM (EU_LLM_API_KEY lub MISTRAL_API_KEY). ' +
      'Skonfiguruj zmienną środowiskową w .env.local. Ciche mockowanie zostało wyłączone zgodnie z regułą VOICE-REPORT-FIDELITY.'
    )
  }

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`EU LLM request failed (${config.model} @ ${config.endpoint}) status: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content
  if (!text || typeof text !== 'string') {
    throw new Error('Pusta odpowiedź z europejskiego modelu LLM')
  }

  return text
}
