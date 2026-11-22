import { beforeEach, describe, expect, it, vi } from 'vitest'

const completion = vi.hoisted(() => vi.fn())
vi.mock('@/lib/eu-llm-client', () => ({ callEuLlmCompletionWithProvenance: completion }))

import {
  classifySanitizedVoiceEvent, generateOperationalCategoryReport, prepareSanitizedVoiceEvent,
} from '../../apps/web/src/lib/voice-report-engine'

const residentId = 'c0aa5a55-f2c2-4252-9fbe-a7346fc1086c'
const eventId = '133c989a-e866-4401-9ae2-ac082a3a47b3'
const registry = { residentNames: ['Anna Nowak'], rooms: ['12'], beds: ['B'] }
const category = { code: 'technical', label: 'Dział techniczny', classifierHint: '',
  enabled: true, archivedAt: null, allowedSections: ['summary', 'source_quotes'] as const }

beforeEach(() => completion.mockReset())

describe('Silnik raportów operacyjnych', () => {
  it('ustala zakres z przypisania i usuwa identyfikatory oraz treść medyczną przed generowaniem @REQ: VOICE-DOCK-REPORTS', () => {
    const event = prepareSanitizedVoiceEvent({
      source: 'APP', scope: 'resident', residentId,
      transcript: 'Jestem Adam Lis. Anna Nowak siedziała w pokoju 12, łóżko B. Dostała paracetamol 500 mg. Serwis sprawdził windę.',
      registry,
    })
    expect(event.sanitizedTranscript).toContain('Serwis sprawdził windę')
    expect(event.sanitizedTranscript).not.toMatch(/Adam|Lis|Anna|Nowak|12|paracetamol|500 mg/i)
    expect(event.extractedMedical.length).toBeGreaterThan(0)
    expect(() => prepareSanitizedVoiceEvent({
      source: 'APP', scope: 'facility', residentId: null, transcript: 'Test', registry,
    })).toThrow('INVALID_CAPTURE_SCOPE')
  })

  it('korzysta z klasyfikacji tylko dla aktywnych kategorii i trzyma zakres placówki poza raportem rodzinnych @REQ: VOICE-DOCK-REPORTS', async () => {
    completion.mockResolvedValue({
      text: JSON.stringify({ category_codes: ['technical'], behavioral_facts: ['Serwis sprawdził windę.'],
        operational_facts: ['Serwis sprawdził windę.'] }), model: 'mistral-small-eu', region: 'EU',
    })
    const event = prepareSanitizedVoiceEvent({ source: 'APP_GENERAL', scope: 'facility', residentId: null,
      transcript: 'Serwis sprawdził windę.', registry })
    const result = await classifySanitizedVoiceEvent(event, [category], registry)
    expect(result).toMatchObject({ categoryCodes: ['technical'], behavioralFacts: [] })
    expect(completion).toHaveBeenCalledOnce()
  })

  it('zapisuje provenance i odrzuca cytat bez pokrycia @REQ: VOICE-DOCK-REPORTS', async () => {
    const events = [{ id: eventId, sanitizedText: 'Sprawdzono oświetlenie na korytarzu.' }]
    expect(await generateOperationalCategoryReport(category, [], registry)).toMatchObject({
      ai_model: 'rule-based-no-data-v1',
      ai_prompt_version: 'rule-based-no-data-v1',
      content: { no_data: true, source_quotes: [] },
    })
    expect(completion).not.toHaveBeenCalled()
    completion.mockResolvedValue({ text: JSON.stringify({ no_data: false, summary: 'Sprawdzono oświetlenie.',
      source_quotes: [{ event_id: eventId, quote: 'Wymieniono żarówkę.' }] }),
    model: 'mistral-small-eu', region: 'EU' })
    await expect(generateOperationalCategoryReport(category, events, registry)).rejects.toThrow('UNGROUNDED_SOURCE_QUOTE')
    completion.mockResolvedValue({ text: JSON.stringify({ no_data: false, summary: 'Sprawdzono oświetlenie.',
      source_quotes: [{ event_id: eventId, quote: 'Sprawdzono oświetlenie' }] }),
    model: 'mistral-small-eu', region: 'EU' })
    expect(await generateOperationalCategoryReport(category, events, registry)).toMatchObject({
      ai_model: 'mistral-small-eu', content: { no_data: false },
    })
  })
})
