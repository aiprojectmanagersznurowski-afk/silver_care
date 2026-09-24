/**
 * Walidator schematu strukturalnego wpisów w daily_logs.data.
 * Zapewnia integralność danych brudnopisu personelu i chroni przed zapisem nieustrukturyzowanego JSON.
 *
 * @REQ: MDR-VOCABULARY
 */

export interface DailyLogDataStructure {
  raw_transcript?: string
  medical_items?: string[]
  discomfort_items?: string[]
  behavioral_items?: string[]
  action?: string
  note?: string
  processed_at?: string
  [key: string]: unknown
}

export function validateDailyLogData(data: unknown): { valid: boolean; error?: string; sanitized?: DailyLogDataStructure } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      valid: false,
      error: 'Pole data w daily_logs musi być poprawnym obiektem JSON (nie tablicą ani wartością prostą).',
    }
  }

  const obj = data as Record<string, unknown>

  // Sprawdź czy nie ma niedozwolonych typów w kluczowych tablicach
  if ('medical_items' in obj && obj.medical_items !== null && !Array.isArray(obj.medical_items)) {
    return { valid: false, error: 'Pole medical_items musi być tablicą ciągów tekstowych.' }
  }

  if ('discomfort_items' in obj && obj.discomfort_items !== null && !Array.isArray(obj.discomfort_items)) {
    return { valid: false, error: 'Pole discomfort_items musi być tablicą ciągów tekstowych.' }
  }

  if ('behavioral_items' in obj && obj.behavioral_items !== null && !Array.isArray(obj.behavioral_items)) {
    return { valid: false, error: 'Pole behavioral_items musi być tablicą ciągów tekstowych.' }
  }

  return {
    valid: true,
    sanitized: obj as DailyLogDataStructure,
  }
}
