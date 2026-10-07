/**
 * Klient modeli językowych hostowanych w Europejskim Obszarze Gospodarczym (EOG)
 * Zgodność z ADR-009 oraz wymaganiem INFRA-EU-REGION / INFRA-GROQ-TRANSCRIPTION:
 * Klasyfikacja strumieni i generowanie raportu dla bliskich odbywają się w EOG.
 * Brak klucza lub endpoint spoza EOG kończy się odmową — bez zapasowego dostawcy.
 */

export interface EuLlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface EuLlmConfig {
  endpoint: string
  apiKey: string
  model: string
  region: 'EU' | 'US_DEMO_INTERIM'
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

/**
 * Sprawdza nazwę hosta, nie cały adres: podciąg w ścieżce lub w parametrach
 * nie może uczynić endpointu „europejskim". Lokalny mock deweloperski jest dozwolony.
 */
export function isEuEndpoint(endpoint: string): boolean {
  let host: string
  try {
    host = new URL(endpoint).hostname.toLowerCase()
  } catch {
    return false
  }
  if (host === 'localhost' || host === '127.0.0.1') return true
  return (
    host === 'mistral.ai' ||
    host.endsWith('.mistral.ai') ||
    host.endsWith('.eu') ||
    /(^|\.)(eu-[a-z0-9-]+|europe-[a-z0-9-]+)\./.test(host)
  )
}

/**
 * ADR-015: tymczasowy fallback CLASSIFY/GENERATE na Groq, wyłącznie na czas demo,
 * przed podpisaniem DPA z Groq na te etapy (PROVIDERS.GROQ_DEMO_LLM w
 * integration.contract.mjs). Wymaga jawnej, osobnej od GROQ_API_KEY zmiennej —
 * sama obecność klucza transkrypcji nic nie aktywuje. Wyłącznie dane syntetyczne/
 * demonstracyjne: zakaz użycia z rzeczywistymi danymi pensjonariuszy do czasu
 * podpisania DPA (operacyjne, nie wymuszone tu technicznie — tak jak zerowa
 * retencja Groq dla TRANSCRIBE w ADR-009 jest przełącznikiem w panelu, nie kodem).
 */
function getDemoGroqFallbackConfig(): EuLlmConfig | null {
  if (process.env.ALLOW_DEMO_GROQ_FALLBACK !== 'true') return null
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null
  return {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey,
    model: 'llama-3.3-70b-versatile',
    region: 'US_DEMO_INTERIM',
  }
}

export async function callEuLlmCompletion(
  messages: EuLlmMessage[],
  temperature: number = 0.1,
  maxTokens: number = 600
): Promise<string> {
  const euConfig = getEuLlmConfig()
  const hasEuKey = !!euConfig.apiKey && euConfig.apiKey !== 'mock_eu_llm_key'

  // Klucz EU ma zawsze pierwszeństwo — tryb demo jest wyłącznie awaryjny, nigdy nadrzędny
  let config: EuLlmConfig = euConfig
  if (!hasEuKey) {
    const demo = getDemoGroqFallbackConfig()
    if (demo) {
      config = demo
      // Bez treści promptu i bez PII — tylko fakt, że raport powstał poza EOG w trybie demo
      console.warn(
        '[EU-LLM-DEMO-FALLBACK] ADR-015: brak klucza EU, użyto Groq w trybie demo ' +
        '(ALLOW_DEMO_GROQ_FALLBACK=true). Wyłącznie dane syntetyczne — nie używać z prawdziwymi podopiecznymi.'
      )
    }
  }

  // Weryfikacja suwerenności danych EOG (zgodność z ADR-009) — przed jakimkolwiek żądaniem.
  // Tryb demo (region US_DEMO_INTERIM) jest jedynym świadomym wyjątkiem od tej reguły.
  if (config.region === 'EU' && !isEuEndpoint(config.endpoint)) {
    throw new Error('[EU-LLM-REGION] Endpoint modelu językowego nie znajduje się w EOG. Żądanie nie zostało wysłane.')
  }

  // Weryfikacja konfiguracji klucza — brak cichego mockowania i brak zapasowego dostawcy
  if (!config.apiKey || config.apiKey === 'mock_eu_llm_key') {
    throw new Error(
      '[EU-LLM-CONFIG] Brak skonfigurowanego klucza API europejskiego modelu LLM (EU_LLM_API_KEY lub MISTRAL_API_KEY). ' +
      'Skonfiguruj zmienną środowiskową w .env.local. Ciche mockowanie i przełączanie na dostawcę spoza EOG są wyłączone.'
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
    // Bez treści odpowiedzi w komunikacie: może odbijać fragmenty promptu.
    throw new Error(`EU LLM request failed (${config.model}) status: ${response.status}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content
  if (!text || typeof text !== 'string') {
    throw new Error('Pusta odpowiedź z europejskiego modelu LLM')
  }

  return text
}
