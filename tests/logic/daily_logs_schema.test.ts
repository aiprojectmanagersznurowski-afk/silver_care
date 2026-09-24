import { describe, it, expect } from 'vitest'
import { validateDailyLogData } from '../../apps/web/src/lib/daily-logs-schema'

describe('Daily Logs JSON Schema Validation (@REQ: MDR-VOCABULARY)', () => {
  it('accepts valid structured daily log payloads @REQ: MDR-VOCABULARY', () => {
    const validData = {
      raw_transcript: 'Pensjonariusz zjadł śniadanie i wyszedł na spacer.',
      medical_items: ['Podano leki poranne'],
      discomfort_items: [],
      behavioral_items: ['Dobry nastrój, aktywność w ogrodzie'],
      processed_at: new Date().toISOString(),
    }

    const result = validateDailyLogData(validData)
    expect(result.valid).toBe(true)
    expect(result.sanitized?.raw_transcript).toBe(validData.raw_transcript)
  })

  it('rejects primitives, nulls and arrays for daily_logs.data @REQ: MDR-VOCABULARY', () => {
    expect(validateDailyLogData(null).valid).toBe(false)
    expect(validateDailyLogData('string text').valid).toBe(false)
    expect(validateDailyLogData(12345).valid).toBe(false)
    expect(validateDailyLogData(['item1', 'item2']).valid).toBe(false)
  })

  it('validates that classification item fields must be arrays of strings @REQ: MDR-VOCABULARY', () => {
    const invalidMedical = {
      raw_transcript: 'Notatka',
      medical_items: 'not an array',
    }
    const res1 = validateDailyLogData(invalidMedical)
    expect(res1.valid).toBe(false)
    expect(res1.error).toContain('medical_items')

    const invalidDiscomfort = {
      raw_transcript: 'Notatka',
      discomfort_items: 123,
    }
    const res2 = validateDailyLogData(invalidDiscomfort)
    expect(res2.valid).toBe(false)
    expect(res2.error).toContain('discomfort_items')
  })
})
