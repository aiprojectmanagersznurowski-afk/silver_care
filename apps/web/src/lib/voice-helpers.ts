export interface ClassifiedNote {
  medical: string | null
  discomfort: string | null
  behavioral: string | null
  followup_question: string | null
  _parseError?: boolean
}

export function extractJson(raw: string, _fallbackText: string): ClassifiedNote {
  // Usun tagi myslenia
  let cleaned = raw.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim()
  // Usun bloki markdown
  cleaned = cleaned.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim()

  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      const jsonStr = cleaned.slice(firstBrace, lastBrace + 1)
      const parsed = JSON.parse(jsonStr)
      return {
        medical: parsed.medical || null,
        discomfort: parsed.discomfort || null,
        behavioral: parsed.behavioral || null,
        followup_question: parsed.followup_question || null,
      }
    } catch {
      // ignore and fallback
    }
  }

  try {
    const parsed = JSON.parse(cleaned)
    return {
      medical: parsed.medical || null,
      discomfort: parsed.discomfort || null,
      behavioral: parsed.behavioral || null,
      followup_question: parsed.followup_question || null,
    }
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
