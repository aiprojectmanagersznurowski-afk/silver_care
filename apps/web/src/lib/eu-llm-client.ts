/**
 * Klient modeli językowych hostowanych w Europejskim Obszarze Gospodarczym (EOG)
 * Zgodność z ADR-009 oraz wymaganiem INFRA-EU-REGION / INFRA-GROQ-TRANSCRIPTION:
 * Klasyfikacja strumieni i generowanie raportu dla bliskich odbywają się w EOG.
 * Brak klucza lub endpoint spoza EOG kończy się odmową — bez zapasowego dostawcy.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

export const CANONICAL_EU_LLM_MODELS = [
  'mistral-large-eu', 'mistral-small-eu', 'gemini-2.5-flash-eu', 'gemini-2.5-pro-eu',
  'gpt-4o-mini-eu', 'gpt-4o-eu', 'claude-3-5-sonnet-eu', 'bielik-11b-v2.3-instruct-eu',
] as const

export type CanonicalEuLlmModelId = (typeof CANONICAL_EU_LLM_MODELS)[number]

export interface EuLlmCompletionWithProvenance {
  text: string
  model: CanonicalEuLlmModelId
  region: 'EU'
}

const EU_LLM_MODEL_ALIASES: Record<string, CanonicalEuLlmModelId> = {
  'mistral-small-latest': 'mistral-small-eu', 'mistral-large-latest': 'mistral-large-eu',
}

/** Mapuje identyfikator modelu dostawcy EOG na kanoniczną białą listę DB lub odrzuca model spoza EOG. */
export function resolveCanonicalEuLlmModelId(rawModel: string): CanonicalEuLlmModelId {
  const normalized = rawModel.trim()
  if ((CANONICAL_EU_LLM_MODELS as readonly string[]).includes(normalized)) {
    return normalized as CanonicalEuLlmModelId
  }
  const aliased = EU_LLM_MODEL_ALIASES[normalized]
  if (aliased) return aliased
  throw new Error('[EU-LLM-MODEL] Model spoza zatwierdzonej białej listy EOG.')
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
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }
  if (url.username || url.password) return false
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1') return ['http:', 'https:'].includes(url.protocol)
  if (url.protocol !== 'https:') return false
  return (
    host === 'mistral.ai' ||
    host.endsWith('.mistral.ai') ||
    host.endsWith('.eu') ||
    /(^|\.)(eu-[a-z0-9-]+|europe-[a-z0-9-]+)\./.test(host)
  )
}

function ensureEnvLoaded() {
  if (typeof process === 'undefined' || !process.env) return
  if (process.env.VITEST) return // nie nadpisuj w testach izolowanych vitest
  if (process.env.ALLOW_DEMO_GROQ_FALLBACK === 'true' && process.env.GROQ_API_KEY) return

  try {
    const candidates = [
      resolve(process.cwd(), '.env.local'),
      resolve(process.cwd(), '../../.env.local'),
      resolve(process.cwd(), '../.env.local'),
    ]
    for (const p of candidates) {
      if (existsSync(p)) {
        const content = readFileSync(p, 'utf8')
        for (const line of content.split('\n')) {
          const trimmed = line.trim()
          if (trimmed && !trimmed.startsWith('#')) {
            const idx = trimmed.indexOf('=')
            if (idx > 0) {
              const key = trimmed.slice(0, idx).trim()
              let val = trimmed.slice(idx + 1).trim()
              if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1)
              }
              if (!process.env[key]) {
                process.env[key] = val
              }
            }
          }
        }
        break
      }
    }
  } catch {
    // ignoruj błędy odczytu plików
  }
}

export function isVoiceRealDataPilot(): boolean {
  return process.env.VOICE_REAL_DATA_PILOT === 'true'
}

/**
 * ADR-015: tymczasowy fallback CLASSIFY/GENERATE na Groq, wyłącznie na czas demo,
 * przed podpisaniem DPA z Groq na te etapy (PROVIDERS.GROQ_DEMO_LLM w
 * integration.contract.mjs). Wymaga jawnej, osobnej od GROQ_API_KEY zmiennej —
 * sama obecność klucza transkrypcji nic nie aktywuje. Wyłącznie dane syntetyczne/
 * demonstracyjne: zakaz użycia z rzeczywistymi danymi podopiecznych do czasu
 * podpisania DPA (operacyjne, nie wymuszone tu technicznie — tak jak zerowa
 * retencja Groq dla TRANSCRIBE w ADR-009 jest przełącznikiem w panelu, nie kodem).
 */
function getDemoGroqFallbackConfig(): EuLlmConfig | null {
  ensureEnvLoaded()
  if (isVoiceRealDataPilot() || process.env.ALLOW_DEMO_GROQ_FALLBACK !== 'true') return null
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null
  const model = process.env.GROQ_LLM_MODEL || 'llama-3.3-70b-versatile'
  return {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey,
    model,
    region: 'US_DEMO_INTERIM',
  }
}

function assertValidLlmConfig(config: EuLlmConfig): void {
  // Weryfikacja suwerenności danych EOG (zgodność z ADR-009) — przed jakimkolwiek żądaniem.
  if (config.region === 'EU' && !isEuEndpoint(config.endpoint)) {
    throw new Error('[EU-LLM-REGION] Endpoint modelu językowego nie znajduje się w EOG. Żądanie nie zostało wysłane.')
  }
  if (!config.apiKey || config.apiKey === 'mock_eu_llm_key') {
    throw new Error(
      '[EU-LLM-CONFIG] Brak skonfigurowanego klucza API europejskiego modelu LLM (EU_LLM_API_KEY lub MISTRAL_API_KEY). ' +
      'Skonfiguruj zmienną środowiskową w .env.local. Ciche mockowanie i przełączanie na dostawcę spoza EOG są wyłączone.'
    )
  }
}

async function postChatCompletion(
  config: EuLlmConfig,
  model: string,
  messages: EuLlmMessage[],
  temperature: number,
  maxTokens: number
): Promise<Response> {
  return fetch(config.endpoint, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(45_000),
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  })
}

async function executeLlmCompletion(
  config: EuLlmConfig,
  messages: EuLlmMessage[],
  temperature: number,
  maxTokens: number
): Promise<string> {
  assertValidLlmConfig(config)
  const requestMaxTokens = config.region === 'US_DEMO_INTERIM' ? Math.max(maxTokens, 1500) : maxTokens
  let response = await postChatCompletion(config, config.model, messages, temperature, requestMaxTokens)

  if (!response.ok && config.region === 'US_DEMO_INTERIM' && response.status === 404) {
    for (const altModel of ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b']) {
      if (altModel === config.model) continue
      const retryRes = await postChatCompletion(config, altModel, messages, temperature, requestMaxTokens)
      if (retryRes.ok) {
        response = retryRes
        break
      }
    }
  }

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

/** Wywołuje model EOG ze ścisłym provenance białej listy i bez fallbacku demo spoza EOG. */
export async function callEuLlmCompletionWithProvenance(
  messages: EuLlmMessage[],
  temperature: number = 0.1,
  maxTokens: number = 600
): Promise<EuLlmCompletionWithProvenance> {
  ensureEnvLoaded()
  const euConfig = getEuLlmConfig()
  assertValidLlmConfig(euConfig)
  const model = resolveCanonicalEuLlmModelId(euConfig.model)
  const text = await executeLlmCompletion(euConfig, messages, temperature, maxTokens)
  return { text, model, region: 'EU' }
}

export async function callEuLlmCompletion(
  messages: EuLlmMessage[],
  temperature: number = 0.1,
  maxTokens: number = 600
): Promise<string> {
  ensureEnvLoaded()
  const euConfig = getEuLlmConfig()
  const hasEuKey = !!euConfig.apiKey && euConfig.apiKey !== 'mock_eu_llm_key'
  let config: EuLlmConfig = euConfig
  if (!hasEuKey && isEuEndpoint(euConfig.endpoint)) {
    const demo = getDemoGroqFallbackConfig()
    if (demo) {
      config = demo
      console.warn(
        '[EU-LLM-DEMO-FALLBACK] ADR-015: brak klucza EU, użyto Groq w trybie demo ' +
        '(ALLOW_DEMO_GROQ_FALLBACK=true). Wyłącznie dane syntetyczne — nie używać z prawdziwymi podopiecznymi.'
      )
    }
  }
  return executeLlmCompletion(config, messages, temperature, maxTokens)
}
