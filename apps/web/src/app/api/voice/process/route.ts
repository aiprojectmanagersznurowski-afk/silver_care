import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface ClassifiedNote {
  medical: string | null
  discomfort: string | null
  behavioral: string | null
  followup_question: string | null
}

const CANDIDATE_MODELS = [
  'groq/compound-mini',
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-20b'
]

async function callGroqCompletion(
  messages: Array<{ role: string; content: string }>,
  temperature: number = 0.1,
  maxTokens: number = 600
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error('Brak konfiguracji GROQ_API_KEY')
  }

  let lastError: Error | null = null

  for (const model of CANDIDATE_MODELS) {
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens
        })
      })

      if (!resp.ok) {
        lastError = new Error(`Groq model ${model} status ${resp.status}`)
        continue
      }

      const json = await resp.json()
      const content = json.choices?.[0]?.message?.content
      if (typeof content === 'string' && content.trim().length > 0) {
        return content
      }
    } catch (err: unknown) {
      const errName = err instanceof Error ? err.name : 'UnknownError'
      lastError = new Error(`Groq error: ${errName}`)
    }
  }

  throw lastError || new Error('Wszystkie modele Groq zakończyły się błędem')
}

function extractJson(raw: string, fallbackText: string): ClassifiedNote {
  // Usuń ewentualne tagi myślenia <think>...</think>
  let cleaned = raw.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim()
  // Usuń bloki markdown typu ```json ... ```
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
        followup_question: parsed.followup_question || null
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
      followup_question: parsed.followup_question || null
    }
  } catch {
    return {
      medical: null,
      discomfort: null,
      behavioral: fallbackText,
      followup_question: null
    }
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { draftId, editedTranscription } = await req.json()
    if (!draftId) {
      return NextResponse.json({ error: 'Brak draftId' }, { status: 400 })
    }

    // 1. Fetch draft
    const { data: draft, error: draftError } = await supabase
      .from('voice_draft_notes')
      .select('*')
      .eq('id', draftId)
      .single()

    if (draftError || !draft) {
      return NextResponse.json({ error: 'Nie znaleziono notatki' }, { status: 404 })
    }

    // Jeśli już przetworzone
    if (draft.status === 'PROCESSED') {
      return NextResponse.json({ error: 'Notatka została już przetworzona' }, { status: 400 })
    }

    const transcription = (typeof editedTranscription === 'string' && editedTranscription.trim() !== '')
      ? editedTranscription.trim()
      : ((draft.transcript || draft.transcription || '') as string).trim()

    if (!transcription) {
      return NextResponse.json({ error: 'Brak treści transkrypcji do przetworzenia' }, { status: 400 })
    }

    if (typeof editedTranscription === 'string' && editedTranscription.trim() !== '' && editedTranscription !== draft.transcript) {
      await supabase.from('voice_draft_notes').update({ transcript: editedTranscription.trim() }).eq('id', draft.id)
    }

    // 2. Groq LLM (Krok 1: Klasyfikator i Redaktor)
    const systemPrompt1 = `Przeanalizuj poniższy transkrypt z opieki nad podopiecznym. 
Tryb ZERO-GUESSING: Wyciągaj wyłącznie twarde fakty z nagrania. Nie zmyślaj, nie domyślaj się, nie dopowiadaj historii, która nie padła w nagraniu.

Dodatkowo, jeżeli uważasz, że notatka jest skrajnie niekompletna i brakuje w niej kluczowego faktu by móc zrozumieć o czym mowa (np. "zmieniłem mu ten no..." - i nie wiemy co, lub "dałem połowę dawki" bez informacji jakiego leku), ustaw wartość 'followup_question' na krótkie pytanie skierowane do pielęgniarki, które doprecyzuje sprawę. W przeciwnym wypadku ustaw 'followup_question' jako null.

Podziel informacje i zwróć DOKŁADNIE TEN FORMAT JSON (bez znaczników markdown, czysty JSON):
{
  "medical": "Wszystkie dane medyczne trafiają TYLKO tutaj! Leki, rozpoznania chorobowe, wyniki badań, parametry życiowe, dawki (albo null jeśli brak).",
  "discomfort": "wymioty, biegunka, nietrzymanie, ból - opisz fakty ogólnie (albo null jeśli brak).",
  "behavioral": "zachowanie, nastrój, apetyt, udział w zajęciach, sen (albo null jeśli brak).",
  "followup_question": "krótkie pytanie do personelu jeśli brakuje niezbędnych faktów (albo null jeśli notatka jest wystarczająca)."
}
Nie dopisuj komentarzy, tylko surowy, poprawny JSON.`

    const raw1 = await callGroqCompletion([
      { role: 'system', content: systemPrompt1 },
      { role: 'user', content: transcription }
    ], 0.1, 800)

    const classified = extractJson(raw1, transcription)

    if (
      classified.followup_question &&
      typeof classified.followup_question === 'string' &&
      classified.followup_question.trim() !== '' &&
      classified.followup_question.trim().toLowerCase() !== 'null'
    ) {
      const q = classified.followup_question.trim()
      await supabase.from('voice_draft_notes')
        .update({ 
          status: 'NEEDS_FOLLOWUP', 
          followup_question: q 
        })
        .eq('id', draft.id)

      return NextResponse.json({ 
        success: true, 
        needsFollowup: true, 
        question: q 
      })
    }

    // 3. Zapis do daily_logs (dane medyczne dla personelu)
    const { error: logError } = await supabase.from('daily_logs').insert({
      resident_id: draft.resident_id,
      nurse_id: user.id,
      data: classified
    })
    
    if (logError) {
      console.error('Log error: Database insert failed')
      return NextResponse.json({ error: 'Błąd zapisu logów personelu' }, { status: 500 })
    }

    // 4. Groq LLM (Krok 2: Generator Raportu)
    const systemPrompt2 = `Jesteś empatycznym asystentem w placówce opiekuńczej. 
Na podstawie poniższych informacji napisz ciepły raport dla rodziny podopiecznego (ok. 3-4 zdania), podsumowujący jego dzień.
Zależy nam, aby raport był szczegółowy w kwestiach behawioralnych. Wpleć w niego konkretne wyciągnięte fakty dotyczące apetytu, nastroju, snu oraz udziału w zajęciach, o ile zostały wspomniane w notatce, tak aby rodzina czuła się poinformowana.

ZASADY KRYTYCZNE (STRICT RULES):
1. Używaj zwrotów typu "Twój bliski" lub "Nasz podopieczny" - nigdy nie zgaduj imienia i zachowaj anonimowość.
2. Zastosowanie określenia na literę p (pod żadnym pozorem) jest ZAKAZANE.
3. ZABRONIONE jest wymienianie nazw leków, wyników badań czy jakichkolwiek terminów medycznych/rozpoznań.
4. Jeśli wystąpił dyskomfort (np. ból, problemy ze snem, wymioty), wspomnij o nim łagodnie i z troską (np. "Wystąpiły drobne trudności, ale sytuacja jest w pełni zaopiekowana").
5. Jeśli podane informacje są puste (null) w obu kategoriach, napisz po prostu, że to był spokojny dzień bez większych zmian.`

    const userPrompt2 = `Informacje o zachowaniu: ${classified.behavioral || 'Brak szczególnych uwag'}
Informacje o dyskomforcie: ${classified.discomfort || 'Brak'}`

    const raw2 = await callGroqCompletion([
      { role: 'system', content: systemPrompt2 },
      { role: 'user', content: userPrompt2 }
    ], 0.4, 600)

    let reportText = raw2
      .replace(/<think>[\s\S]*?(<\/think>|$)/gi, '')
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    // Ostateczny filtr bezpieczeństwa językowego (zakaz słowa na p)
    reportText = reportText
      .replace(/\bpacjent[\w]*\b/gi, 'podopieczny')
      .replace(/\bPacjent[\w]*\b/gi, 'Podopieczny')

    // 5. Zapis szkicu do daily_reports
    const { error: insertReportError } = await supabase.from('daily_reports').insert({
      resident_id: draft.resident_id,
      author_id: user.id,
      content: { text: reportText },
      status: 'DRAFT',
      ai_generated: true
    })

    if (insertReportError) {
      console.error('Draft error: Database insert failed')
      return NextResponse.json({ error: 'Błąd zapisu raportu' }, { status: 500 })
    }

    // 6. Aktualizacja draftu
    await supabase.from('voice_draft_notes')
      .update({ status: 'PROCESSED' })
      .eq('id', draft.id)

    return NextResponse.json({ success: true, report: reportText })
  } catch (error: unknown) {
    console.error('Process Error: An unexpected error occurred')
    const errMsg = error instanceof Error ? error.message : 'Wystąpił nieoczekiwany błąd'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
