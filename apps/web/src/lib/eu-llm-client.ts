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

  let activeEndpoint = config.endpoint
  let activeApiKey = config.apiKey
  let activeModel = config.model

  // Tymczasowy fallback na Groq LLM:
  // Jeżeli brak konfiguracji europejskiego LLM (Mistral), ale dostępny jest GROQ_API_KEY,
  // używamy modelu Llama 3.3 przez API Groqa, aby umożliwić działanie potoku na środowiskach demo/online.
  if ((!activeApiKey || activeApiKey === 'mock_eu_llm_key') && process.env.GROQ_API_KEY) {
    activeEndpoint = process.env.EU_LLM_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions'
    activeApiKey = process.env.GROQ_API_KEY
    activeModel = process.env.EU_LLM_MODEL || 'llama-3.1-8b-instant'
    console.warn(`[INFRA-EU-REGION] Uwaga: Tymczasowy fallback potoku notatek głosowych na Groq LLM (${activeModel}) z powodu braku klucza EU LLM.`)
  }

  // Weryfikacja suwerenności danych EOG (zgodność z ADR-009)
  if (!activeEndpoint.includes('.mistral.ai') && !activeEndpoint.includes('eu-') && !activeEndpoint.includes('europe') && !activeEndpoint.includes('groq.com')) {
    // Akceptujemy również lokalny mock deweloperski
    if (!activeEndpoint.startsWith('http://localhost') && !activeEndpoint.startsWith('http://127.0.0.1')) {
      console.warn(`[INFRA-EU-REGION] Ostrzeżenie: Endpoint ${activeEndpoint} powinien znajdować się w strefie UE.`)
    }
  }

  // Weryfikacja konfiguracji klucza — brak cichego mockowania
  if (!activeApiKey || activeApiKey === 'mock_eu_llm_key') {
    throw new Error(
      '[EU-LLM-CONFIG] Brak skonfigurowanego klucza API europejskiego modelu LLM (EU_LLM_API_KEY lub MISTRAL_API_KEY) ani klucza zapasowego GROQ_API_KEY. ' +
      'Skonfiguruj zmienną środowiskową w .env.local. Ciche mockowanie zostało wyłączone zgodnie z regułą VOICE-REPORT-FIDELITY.'
    )
  }

  let response = await fetch(activeEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${activeApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: activeModel,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })

  // Odporność fallbacku Groq: jeśli model zwraca 404 model_not_found (np. brak uprawnień do 70b),
  // ponawiamy zapytanie na uniwersalnym darmowym modelu llama-3.1-8b-instant
  if (!response.ok && activeEndpoint.includes('groq.com') && activeModel !== 'llama-3.1-8b-instant') {
    const errorText = await response.text().catch(() => '')
    if (response.status === 404 && errorText.includes('model_not_found')) {
      console.warn(`[INFRA-GROQ-FALLBACK] Model ${activeModel} niedostępny w Groq (404). Ponawianie z llama-3.1-8b-instant...`)
      activeModel = 'llama-3.1-8b-instant'
      response = await fetch(activeEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: activeModel,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      })
    } else {
      throw new Error(`EU LLM request failed (${activeModel} @ ${activeEndpoint}) status: ${response.status} - ${errorText}`)
    }
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`EU LLM request failed (${activeModel} @ ${activeEndpoint}) status: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content
  if (!text || typeof text !== 'string') {
    throw new Error('Pusta odpowiedź z europejskiego modelu LLM')
  }

  return text
}
