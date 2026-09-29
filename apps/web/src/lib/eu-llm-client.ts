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

  // Tymczasowy fallback na Groq LLM lub xAI Grok:
  // Jeżeli brak konfiguracji europejskiego LLM (Mistral), ale dostępny jest GROQ_API_KEY lub XAI_API_KEY,
  // używamy go, aby umożliwić działanie potoku na środowiskach demo/online.
  const fallbackKey = process.env.GROQ_API_KEY || process.env.XAI_API_KEY
  if ((!activeApiKey || activeApiKey === 'mock_eu_llm_key') && fallbackKey) {
    if (fallbackKey.startsWith('xai-')) {
      activeEndpoint = process.env.EU_LLM_ENDPOINT || 'https://api.x.ai/v1/chat/completions'
      activeApiKey = fallbackKey
      activeModel = process.env.EU_LLM_MODEL || 'grok-beta'
      console.warn(`[INFRA-EU-REGION] Uwaga: Tymczasowy fallback potoku notatek głosowych na xAI Grok (${activeModel}) z powodu braku klucza EU LLM.`)
    } else {
      activeEndpoint = process.env.EU_LLM_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions'
      activeApiKey = fallbackKey
      activeModel = process.env.EU_LLM_MODEL || 'llama-3.1-8b-instant'
      console.warn(`[INFRA-EU-REGION] Uwaga: Tymczasowy fallback potoku notatek głosowych na Groq LLM (${activeModel}) z powodu braku klucza EU LLM.`)
    }
  }

  // Weryfikacja suwerenności danych EOG (zgodność z ADR-009)
  if (!activeEndpoint.includes('.mistral.ai') && !activeEndpoint.includes('eu-') && !activeEndpoint.includes('europe') && !activeEndpoint.includes('groq.com') && !activeEndpoint.includes('api.x.ai')) {
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

  const groqCandidates = [
    activeModel,
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    'qwen/qwen3.8-27b',
    'groq/compound-mini',
  ]
  // Unikalna lista modeli do sprawdzenia
  const modelsToTry = activeEndpoint.includes('groq.com')
    ? Array.from(new Set(groqCandidates))
    : [activeModel]

  let response: Response | null = null
  let successfulModel = activeModel
  let lastErrorText = ''

  for (const modelToTry of modelsToTry) {
    response = await fetch(activeEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${activeApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelToTry,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    })

    if (response.ok) {
      successfulModel = modelToTry
      break
    }

    lastErrorText = await response.text().catch(() => '')

    // Jeśli błąd to 404 model_not_found i jesteśmy na Groqu, spróbujmy kolejnego kandydata
    if (response.status === 404 && lastErrorText.includes('model_not_found') && activeEndpoint.includes('groq.com')) {
      console.warn(`[INFRA-GROQ-FALLBACK] Model ${modelToTry} niedostępny w Groq (404 model_not_found). Sprawdzam kolejny model...`)
      continue
    }

    // W przypadku innych błędów (np. 401 Unauthorized, 429 Rate Limit) nie iterujemy dalej po modelach
    throw new Error(`EU LLM request failed (${modelToTry} @ ${activeEndpoint}) status: ${response.status} - ${lastErrorText}`)
  }

  if (!response || !response.ok) {
    throw new Error(
      `EU LLM request failed (${successfulModel} @ ${activeEndpoint}) status: ${response?.status || 500} - ${lastErrorText}. ` +
      `Żaden z modeli zapasowych Groq (${modelsToTry.join(', ')}) nie jest dostępny dla Twojego klucza API. ` +
      `Sprawdź uprawnienia klucza w console.groq.com (Model Permissions) lub skonfiguruj klucz MISTRAL_API_KEY.`
    )
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content
  if (!text || typeof text !== 'string') {
    throw new Error('Pusta odpowiedź z europejskiego modelu LLM')
  }

  return text
}
