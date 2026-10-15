export interface ClassifiedNote {
  medical: string | null
  discomfort: string | null
  behavioral: string | null
  followup_question: string | null
  _parseError?: boolean
}

export function extractJson(raw: string, _fallbackText?: string): ClassifiedNote {
  // Usun tagi myslenia
  let cleaned = raw.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim()
  // Usun bloki markdown
  cleaned = cleaned.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim()

  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')

  const parseObj = (parsed: Record<string, unknown>): ClassifiedNote => {
    const extractedStreams = parsed.extracted_streams as Record<string, unknown> | undefined
    const getStream = (key: 'medical' | 'discomfort' | 'behavioral') => {
      if (typeof parsed[key] === 'string') return parsed[key] as string
      if (extractedStreams && extractedStreams[key]) {
        return Array.isArray(extractedStreams[key])
          ? (extractedStreams[key] as unknown[]).join('; ')
          : String(extractedStreams[key])
      }
      return null
    }

    return {
      medical: getStream('medical'),
      discomfort: getStream('discomfort'),
      behavioral: getStream('behavioral'),
      followup_question: typeof parsed.followup_question === 'string' ? parsed.followup_question : null,
    }
  }

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      const jsonStr = cleaned.slice(firstBrace, lastBrace + 1)
      const parsed = JSON.parse(jsonStr)
      return parseObj(parsed)
    } catch {
      // ignore and fallback
    }
  }

  try {
    const parsed = JSON.parse(cleaned)
    return parseObj(parsed)
  } catch {
    // ADR-007: Surowy transkrypt nie moze trafic do strumienia behawioralnego
    return {
      medical: null,
      discomfort: null,
      behavioral: null,
      followup_question: null,
      _parseError: true,
    }
  }
}

export interface AudioFormatInfo {
  mimeType: string
  ext: 'webm' | 'mp4' | 'ogg' | string
}

/**
 * Detekcja formatu audio wspieranego przez MediaRecorder w przeglądarce.
 * Kolejność priorytetów:
 * 1. audio/webm;codecs=opus (Chrome/Firefox/Android)
 * 2. audio/webm
 * 3. audio/mp4 (kluczowe dla iOS Safari / WebKit)
 * 4. audio/ogg;codecs=opus
 */
export function detectSupportedAudioFormat(): AudioFormatInfo {
  if (
    typeof window === 'undefined' ||
    typeof MediaRecorder === 'undefined' ||
    typeof MediaRecorder.isTypeSupported !== 'function'
  ) {
    return { mimeType: '', ext: 'webm' }
  }

  const candidateFormats: AudioFormatInfo[] = [
    { mimeType: 'audio/webm;codecs=opus', ext: 'webm' },
    { mimeType: 'audio/webm', ext: 'webm' },
    { mimeType: 'audio/mp4', ext: 'mp4' },
    { mimeType: 'audio/ogg;codecs=opus', ext: 'ogg' },
  ]

  for (const candidate of candidateFormats) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate
    }
  }

  return { mimeType: '', ext: 'webm' }
}

export function getExtensionFromMimeType(mimeType: string): string {
  const lower = mimeType.toLowerCase()
  if (lower.includes('mp4')) return 'mp4'
  if (lower.includes('m4a') || lower.includes('aac')) return 'm4a'
  if (lower.includes('ogg')) return 'ogg'
  if (lower.includes('wav')) return 'wav'
  if (lower.includes('webm')) return 'webm'
  return 'webm'
}

export interface GroqTranscriptionResult {
  text: string
}

export async function transcribeWithGroq(
  file: Blob | File,
  apiKey: string,
  options?: { filename?: string; language?: string }
): Promise<GroqTranscriptionResult> {
  if (!apiKey) {
    throw new Error('Brak konfiguracji GROQ_API_KEY')
  }

  if (!file || file.size === 0) {
    throw new Error('Brak pliku dźwiękowego lub nagranie jest puste')
  }

  const defaultExt = getExtensionFromMimeType(file.type || 'audio/webm')
  const defaultName = `recording.${defaultExt}`
  const filename = options?.filename || (file instanceof File && file.name ? file.name : defaultName)

  const groqFormData = new FormData()
  groqFormData.append('file', file, filename)
  groqFormData.append('model', 'whisper-large-v3')
  groqFormData.append('language', options?.language || 'pl')

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: groqFormData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    let parsedMsg = 'Błąd podczas transkrypcji Groq'
    try {
      const parsed = JSON.parse(errorText)
      if (parsed.error?.message) {
        parsedMsg = `Błąd Groq API: ${parsed.error.message}`
      }
    } catch {}
    const err = new Error(parsedMsg)
    const status = response.status === 401 ? 502 : response.status
    Object.assign(err, { status })
    throw err
  }

  const result = await response.json()
  return { text: (result.text || '').trim() }
}
