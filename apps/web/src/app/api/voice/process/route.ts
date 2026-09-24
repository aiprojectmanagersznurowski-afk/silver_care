import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callEuLlmCompletion } from '@/lib/eu-llm-client'
import { 
  VOICE_PROCESSING_PROMPT, 
  FAMILY_REPORT_PROMPT, 
  ZERO_GUESSING_DIRECTIVE 
} from '@silvercare/contracts/src/prompts'
import { 
  validateReportText, 
  validateNoMedicalDataInReport 
} from '@silvercare/contracts/src/validation'
import { AI_DISCLOSURE_LABEL } from '@silvercare/contracts/src/generated/presentation'

export const runtime = 'nodejs'

interface ClassifiedNote {
  medical: string | null
  discomfort: string | null
  behavioral: string | null
  followup_question: string | null
}

const REPORT_LLM_MODEL = process.env.REPORT_LLM_MODEL || 'mistralai/mistral-small-24b-instruct-2501'

function extractJson(raw: string, fallbackText: string): ClassifiedNote {
  let cleaned = raw.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim()
  cleaned = cleaned.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim()

  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      const jsonStr = cleaned.slice(firstBrace, lastBrace + 1)
      const parsed = JSON.parse(jsonStr)
      return {
        medical: parsed.medical || (parsed.extracted_streams?.medical ? parsed.extracted_streams.medical.join('; ') : null),
        discomfort: parsed.discomfort || (parsed.extracted_streams?.discomfort ? parsed.extracted_streams.discomfort.join('; ') : null),
        behavioral: parsed.behavioral || (parsed.extracted_streams?.behavioral ? parsed.extracted_streams.behavioral.join('; ') : null),
        followup_question: parsed.followup_question || null
      }
    } catch {
      // fallback
    }
  }

  try {
    const parsed = JSON.parse(cleaned)
    return {
      medical: parsed.medical || (parsed.extracted_streams?.medical ? parsed.extracted_streams.medical.join('; ') : null),
      discomfort: parsed.discomfort || (parsed.extracted_streams?.discomfort ? parsed.extracted_streams.discomfort.join('; ') : null),
      behavioral: parsed.behavioral || (parsed.extracted_streams?.behavioral ? parsed.extracted_streams.behavioral.join('; ') : null),
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
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined
    const supabase = await createClient(token)

    let user = null
    if (token) {
      const { data: authData } = await supabase.auth.getUser(token)
      user = authData?.user || null
    }
    if (!user) {
      const { data: cookieAuthData } = await supabase.auth.getUser()
      user = cookieAuthData?.user || null
    }

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

    // Strict zero-guessing: resident_id must exist as UUID on the draft
    if (!draft.resident_id) {
      return NextResponse.json({ error: 'Brak wymaganego identyfikatora resident_id na notatce' }, { status: 400 })
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

    // 2. Europejski LLM w EOG (Krok 1: Klasyfikator i Redakcja Medyczna wg VOICE_PROCESSING_PROMPT)
    // Tryb ZERO-GUESSING: Wyciągaj wyłącznie twarde fakty z nagrania.
    const systemPrompt1 = `${VOICE_PROCESSING_PROMPT}\n${ZERO_GUESSING_DIRECTIVE}\n
Notatka może zawierać sekcję [UZUPEŁNIENIE:], która stanowi dopowiedź personelu. Połącz wszystkie fakty ze wszystkich części notatki.
Jeżeli notatka jest skrajnie niekompletna, ustaw wartość 'followup_question' na krótkie pytanie doprecyzowujące (albo null jeśli wystarczająca).

Podziel informacje i zwróć czysty format JSON:
{
  "medical": "dane medyczne (leki, dawki, rozpoznania, parametry, wyniki badań) lub null",
  "discomfort": "ogólny opis dyskomfortu (zmęczenie, ból, złe samopoczucie) lub null",
  "behavioral": "fakty behawioralne (posiłki, aktywności, spacery, sen, nastrój) lub null",
  "followup_question": "krótkie pytanie lub null"
}`

    const raw1 = await callEuLlmCompletion([
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

    // 3. Zapis do daily_logs (dane medyczne dla personelu — brudnopis)
    const { error: logError } = await supabase.from('daily_logs').insert({
      resident_id: draft.resident_id,
      nurse_id: user.id,
      data: classified
    })
    
    if (logError) {
      return NextResponse.json({ error: 'Błąd zapisu logów personelu' }, { status: 500 })
    }

    // 4. GENERATE (Krok 2: Generator Raportu dla Bliskich) — ETAP REDACT: classified.medical ZOSTANIE POMINIĘTY
    const systemPrompt2 = `${FAMILY_REPORT_PROMPT}\n${ZERO_GUESSING_DIRECTIVE}\n
Pamiętaj:
1. Używaj zwrotów typu "Twój bliski" lub "Nasz podopieczny" - nigdy nie zgaduj imienia i zachowaj anonimowość.
2. Zastosowanie określenia na literę p (pod żadnym pozorem) jest ZAKAZANE.
3. ZABRONIONE jest wymienianie nazw leków, wyników badań czy jakichkolwiek terminów medycznych/rozpoznań.
4. Jeśli wystąpił dyskomfort, wspomnij o nim łagodnie i z troską.
5. Dołącz informację: "${AI_DISCLOSURE_LABEL}".`

    const userPrompt2 = `Informacje o zachowaniu: ${classified.behavioral || 'Brak szczególnych uwag'}
Informacje o dyskomforcie: ${classified.discomfort || 'Brak'}`

    const raw2 = await callEuLlmCompletion([
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

    // Upewnij się, że etykieta AI Act jest dołączona
    if (!reportText.includes(AI_DISCLOSURE_LABEL)) {
      reportText = `${reportText}\n\n${AI_DISCLOSURE_LABEL}`
    }

    // Post-generation validation (MDR-NO-INTERPRETATION & VOICE-MEDICAL-STRIP)
    const mdrValidation = validateReportText(reportText)
    const medicalCheck = validateNoMedicalDataInReport(reportText)

    if (!mdrValidation.valid || medicalCheck.hasMedical) {
      // Sanitize or fallback to clean generic statement if guardrail violated
      reportText = `Twój bliski spędził dzisiaj spokojny dzień w placówce pod troskliwą opieką naszego personelu.\n\n${AI_DISCLOSURE_LABEL}`
    }

    // 5. REJOIN: Złączenie z tożsamością pensjonariusza i zapis szkicu do daily_reports z AI provenance
    const { error: insertReportError } = await supabase.from('daily_reports').insert({
      resident_id: draft.resident_id,
      author_id: user.id,
      content: { text: reportText },
      status: 'DRAFT',
      ai_generated: true,
      ai_model: REPORT_LLM_MODEL,
      ai_prompt_version: 'v1.0.0-mdr-compliant',
      ai_generated_at: new Date().toISOString()
    })

    if (insertReportError) {
      return NextResponse.json({ error: 'Błąd zapisu raportu' }, { status: 500 })
    }

    // 6. Aktualizacja draftu
    await supabase.from('voice_draft_notes')
      .update({ status: 'PROCESSED', followup_question: null })
      .eq('id', draft.id)

    return NextResponse.json({ success: true, report: reportText })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Wystąpił nieoczekiwany błąd'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
