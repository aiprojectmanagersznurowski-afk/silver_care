import { CAPTURE_SOURCES, OPERATIONAL_REPORT_ENGINE, PROMPT_VERSION } from '@silvercare/contracts/src/generated/voice'
import { validateNoMedicalDataInReport, validateReportText } from '@silvercare/contracts/src/validation'
import { callEuLlmCompletionWithProvenance } from '@/lib/eu-llm-client'
import { redactVoiceTranscript, sanitizeReportAndVerifySafety } from '@/lib/voice-redactor'

type CaptureSource = (typeof CAPTURE_SOURCES)[number]['id']
type Scope = 'resident' | 'facility'
type Section = (typeof OPERATIONAL_REPORT_ENGINE.allowedSections)[number]

export interface VoiceReportRegistry {
  residentNames: readonly string[]
  rooms: readonly string[]
  beds: readonly string[]
}

export interface OperationalReportCategory {
  code: string
  label: string
  classifierHint: string
  enabled: boolean
  archivedAt: string | null
  allowedSections: readonly Section[]
}

interface SanitizedVoiceEvent {
  scope: Scope
  sanitizedTranscript: string
  extractedMedical: string[]
}

interface ReportEvent {
  id: string
  sanitizedText: string
}

type SourceQuote = { event_id: string; quote: string }
type ReportContent = {
  no_data: boolean
  summary: string
  events?: string[]
  locations?: string[]
  action_items?: string[]
  source_quotes?: SourceQuote[]
}

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const noDataModel = 'rule-based-no-data-v1'
const noDataSummary = 'Brak zarejestrowanych zdarzeń w wybranym okresie.'
const arraySections = ['events', 'locations', 'action_items'] as const
const escape = (value: string) => value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')

function replaceRegistryIdentifiers(text: string, registry: VoiceReportRegistry) {
  let result = text.replace(/(?<!\p{L})[Jj]estem\s+\p{Lu}[\p{L}'-]+\s+\p{Lu}[\p{L}'-]+/gu, '[autor]')
  const names = new Set(registry.residentNames.flatMap((name) => name.trim().split(/\s+/)).filter(Boolean))
  for (const name of names) {
    result = result.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, 'giu'), '[osoba]')
  }
  for (const room of registry.rooms.filter(Boolean)) {
    result = result.replace(new RegExp(`(?<![\\p{L}\\p{N}])(?:pokój|pokoju|w)\\s+${escape(room)}(?![\\p{L}\\p{N}])`, 'giu'), '[pokój]')
  }
  for (const bed of registry.beds.filter(Boolean)) {
    result = result.replace(new RegExp(`(?<![\\p{L}\\p{N}])(?:łóżko|łóżku|łóżka)\\s+${escape(bed)}(?![\\p{L}\\p{N}])`, 'giu'), '[łóżko]')
  }
  return result
}

function safeReportText(value: string, registry: VoiceReportRegistry) {
  const withMaskedRegistry = replaceRegistryIdentifiers(value, registry)
  const redaction = redactVoiceTranscript(withMaskedRegistry)
  const text = redaction.cleanedTranscript.trim()
  if (!text || redaction.hasMedicalData || !validateReportText(text).valid
    || validateNoMedicalDataInReport(text).hasMedical || /(?<!\p{L})pacjen[tc]\p{L}*/iu.test(text)) {
    throw new Error('UNSAFE_REPORT_TEXT')
  }
  return text
}

export function prepareSanitizedVoiceEvent(input: {
  source: CaptureSource; scope: Scope; residentId: string | null; transcript: string; registry: VoiceReportRegistry
}): SanitizedVoiceEvent {
  const scopes = OPERATIONAL_REPORT_ENGINE.captureScopes[input.source] as readonly string[] | undefined
  if (!scopes?.includes(input.scope) || (input.scope === 'resident' ? !uuid.test(input.residentId ?? '') : input.residentId !== null)) {
    throw new Error('INVALID_CAPTURE_SCOPE')
  }
  const { extractedMedical, cleanedTranscript } = redactVoiceTranscript(input.transcript)
  const text = replaceRegistryIdentifiers(cleanedTranscript, input.registry).trim()
  const hasContent = /[\p{L}\p{N}]/u.test(text.replace(/\[[^\]]+\]/g, ''))
  return { scope: input.scope, sanitizedTranscript: hasContent ? text : '', extractedMedical }
}

function jsonObject(raw: string): Record<string, unknown> {
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_REPORT_PAYLOAD')
  return value as Record<string, unknown>
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    throw new Error('INVALID_REPORT_SECTION_SHAPE')
  }
  return value
}

export async function classifySanitizedVoiceEvent(
  event: SanitizedVoiceEvent, categories: readonly OperationalReportCategory[], registry: VoiceReportRegistry,
) {
  if (!event.sanitizedTranscript) return { categoryCodes: [], behavioralFacts: [], operationalFacts: [] }
  const active = categories.filter((category) => category.enabled && category.archivedAt === null)
  const config = active.map(({ code, label, classifierHint }) => ({
    code,
    label: safeReportText(label, registry),
    hint: classifierHint ? safeReportText(classifierHint, registry) : '',
  }))
  const completion = await callEuLlmCompletionWithProvenance([
    { role: 'system', content: 'Klasyfikuj wyłącznie dane wejściowe. Zwróć JSON z tablicami category_codes, behavioral_facts, operational_facts. Fakty podawaj jako dokładne cytaty. Każdy cytat należy do jednej grupy.' },
    { role: 'user', content: JSON.stringify({ categories: config, scope: event.scope, note: safeReportText(event.sanitizedTranscript, registry) }) },
  ])
  const output = jsonObject(completion.text)
  const codes = strings(output.category_codes)
  if (codes.some((code) => !active.some((category) => category.code === code))) throw new Error('INVALID_MATCHED_CATEGORY')
  const operationalFacts = strings(output.operational_facts)
  const behavioralFacts = strings(output.behavioral_facts)
  if ([...operationalFacts, ...behavioralFacts].some((fact) => !event.sanitizedTranscript.includes(fact))) {
    throw new Error('UNGROUNDED_CLASSIFICATION')
  }
  return {
    categoryCodes: [...new Set(codes)],
    operationalFacts: [...new Set(operationalFacts)],
    behavioralFacts: event.scope === 'resident'
      ? [...new Set(behavioralFacts)].filter((fact) => !operationalFacts.some((other) => other.includes(fact) || fact.includes(other)))
      : [],
  }
}

export function scrubAndVerifyOperationalReportOutput(
  output: Record<string, unknown>, sections: readonly Section[], events: readonly ReportEvent[], registry: VoiceReportRegistry,
): ReportContent {
  const expected = new Set(['no_data', 'summary', ...sections])
  if (Object.keys(output).length !== expected.size || Object.keys(output).some((key) => !expected.has(key))
    || output.no_data !== false || typeof output.summary !== 'string') {
    throw new Error('INVALID_REPORT_CONTENT_KEYS')
  }
  const summary = sanitizeReportAndVerifySafety(safeReportText(output.summary, registry))
  if (summary.requiresStaffReview) throw new Error('UNSAFE_REPORT_TEXT')
  const content: ReportContent = { no_data: false, summary: summary.reportText }
  for (const section of arraySections) {
    if (expected.has(section)) content[section] = strings(output[section]).map((value) => safeReportText(value, registry))
  }
  if (expected.has('source_quotes')) {
    if (!Array.isArray(output.source_quotes)) throw new Error('INVALID_SOURCE_QUOTE_SHAPE')
    content.source_quotes = output.source_quotes.map((value) => {
      if (!value || typeof value !== 'object' || Object.keys(value).length !== 2
        || typeof value.event_id !== 'string' || typeof value.quote !== 'string') {
        throw new Error('INVALID_SOURCE_QUOTE_SHAPE')
      }
      const quote = safeReportText(value.quote, registry)
      if (!events.some((event) => event.id === value.event_id && event.sanitizedText.includes(quote))) {
        throw new Error('UNGROUNDED_SOURCE_QUOTE')
      }
      return { event_id: value.event_id, quote }
    })
  }
  return content
}

export async function generateOperationalCategoryReport(
  category: OperationalReportCategory, events: readonly ReportEvent[], registry: VoiceReportRegistry,
) {
  if (!events.length) {
    const content: ReportContent = { no_data: true, summary: noDataSummary }
    for (const section of category.allowedSections) {
      if (section !== 'summary') content[section] = []
    }
    return { content, ai_model: noDataModel, ai_prompt_version: noDataModel }
  }
  const safeEvents = events.map(({ id, sanitizedText }) => ({ id, sanitizedText: safeReportText(sanitizedText, registry) }))
  const completion = await callEuLlmCompletionWithProvenance([
    { role: 'system', content: 'Zwróć JSON wyłącznie na podstawie zdarzeń wejściowych. Pola obowiązkowe: no_data=false i summary. Dołącz tylko wskazane sekcje. Każdy cytat ma event_id oraz dokładny quote z danego zdarzenia. W pozostałych sekcjach zwracaj tablice tekstu.' },
    { role: 'user', content: JSON.stringify({ category: safeReportText(category.label, registry),
      sections: category.allowedSections, events: safeEvents }) },
  ])
  return {
    content: scrubAndVerifyOperationalReportOutput(jsonObject(completion.text), category.allowedSections, safeEvents, registry),
    ai_model: completion.model,
    ai_prompt_version: PROMPT_VERSION,
  }
}
