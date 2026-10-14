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
