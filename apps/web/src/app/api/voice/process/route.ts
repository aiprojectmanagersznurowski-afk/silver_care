import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callEuLlmCompletion } from '@/lib/eu-llm-client'

export const runtime = 'nodejs'

import { extractJson } from '@/lib/voice-helpers'

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

    // 2. Europejski LLM w EOG (Krok 1: Klasyfikator i Redakcja Medyczna - ADR-009)
    const systemPrompt1 = `Przeanalizuj poniższy transkrypt z opieki nad podopiecznym.
Tryb ZERO-GUESSING: Wyciągaj wyłącznie twarde fakty z nagrania. Nie zmyślaj, nie domyślaj się, nie dopowiadaj historii, która nie padła w nagraniu.

Notatka może zawierać sekcję [UZUPEŁNIENIE:], która stanowi dopowiedź lub odpowiedź personelu na wcześniejsze pytanie (np. o dawkę leku, godzinę, szczegół). Połącz wszystkie fakty ze wszystkich części notatki w spójną całość.

Dodatkowo, jeżeli uważasz, że notatka jest skrajnie niekompletna i brakuje w niej kluczowego faktu by móc zrozumieć o czym mowa (np. "zmieniłem mu ten no..." - i nie wiemy co, lub "dałem połowę dawki" bez informacji jakiego leku), ustaw wartość 'followup_question' na krótkie pytanie skierowane do pielęgniarki, które doprecyzuje sprawę. Jeśli notatka lub jej uzupełnienie wyjaśnia sprawę (np. podano już dawkę lub nazwę leku, podano parametry), BEZWZGLĘDNIE ustaw 'followup_question' jako null.

Podziel informacje i zwróć DOKŁADNIE TEN FORMAT JSON (bez znaczników markdown, czysty JSON):
{
  "medical": "Wszystkie dane medyczne trafiają TYLKO tutaj! Leki, rozpoznania chorobowe, wyniki badań, parametry życiowe, dawki (albo null jeśli brak).",
  "discomfort": "wymioty, biegunka, nietrzymanie, ból - opisz fakty ogólnie (albo null jeśli brak).",
  "behavioral": "zachowanie, nastrój, apetyt, udział w zajęciach, sen (albo null jeśli brak).",
  "followup_question": "krótkie pytanie do personelu jeśli brakuje niezbędnych faktów (albo null jeśli notatka jest wystarczająca)."
}
Nie dopisuj komentarzy, tylko surowy, poprawny JSON.`

    const raw1 = await callEuLlmCompletion([
      { role: 'system', content: systemPrompt1 },
      { role: 'user', content: transcription }
    ], 0.1, 800)

    const classified = extractJson(raw1, transcription)

    if (classified._parseError) {
      await supabase.from('voice_draft_notes')
        .update({ 
          status: 'ERROR', 
          followup_question: 'Wystąpił błąd klasyfikacji notatki. Prosimy o ponowne nagranie.' 
        })
        .eq('id', draft.id)

      return NextResponse.json({ 
        success: false, 
        error: 'Błąd klasyfikacji treści notatki. Ze względów bezpieczeństwa (ADR-007) dane nie zostały przekazane do generatora raportu.' 
      }, { status: 422 })
    }

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

    // 4. Europejski LLM w EOG (Krok 2: Generator Raportu dla Bliskich - ADR-009)
    const systemPrompt2 = `Jesteś empatycznym asystentem w placówce opiekuńczej. 
Na podstawie poniższych informacji napisz ciepły raport dla rodziny podopiecznego (ok. 3-4 zdania), podsumowujący jego dzień.
Zależy nam, aby raport był szczegółowy w kwestiach behawioralnych. Wpleć w niego konkretne wyciągnięte fakty dotyczące apetytu, nastroju, snu oraz udziału w zajęciach, o ile zostały wspomniane w notatce, tak aby rodzina czuła się poinformowana.

ZASADY KRYTYCZNE (STRICT RULES):
1. Używaj zwrotów typu "Twój bliski" lub "nasz podopieczny" - nigdy nie zgaduj imienia i zachowaj anonimowość.
2. Zastosowanie określenia na literę p (pod żadnym pozorem) jest ZAKAZANE.
3. ZABRONIONE jest wymienianie nazw leków, parametrów klinicznych czy informacji medycznych (ADR-007).
4. DIGNITY TRANSLATION: Jeśli w strumieniu pojawił się dyskomfort (np. zmęczenie, gorsze samopoczucie, trudność fizjologiczna), opisz go w sposób ogólny i z godnością, ZAWSZE dodając reakcję personelu (np. zapewniono odpoczynek) oraz bieżący stan (np. sytuacja jest w pełni zaopiekowana, podopieczny odpoczywa). Nigdy nie usuwaj faktu wystąpienia trudności.
5. NO FABRICATION: Jeśli podane informacje są puste (null) w obu kategoriach, napisz DOKŁADNIE: "Personel placówki sprawował opiekę nad Twoim bliskim przez cały dzień. Nie odnotowano zdarzeń wymagających osobnego opisania w tym raporcie." Nie zmyślaj o spokojnym dniu ani o spacerach, jeśli nie ma ich w danych.
6. TRAJEKTORIA: Jeśli dzień zawierał trudniejszy poranek i późniejszą poprawę, przedstaw obie części tworząc spójny i prawdziwy obraz dnia.`

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

    // Ostateczny filtr bezpieczeństwa słownika MDR
    const forbiddenMdrRegex = new RegExp('\\b' + 'pacjen' + '[tc]\\w*\\b', 'i')
    if (forbiddenMdrRegex.test(reportText)) {
      console.warn('[MDR-VOCABULARY] Raport zawiera zakazane słowo. Blokada zapisu.')
      await supabase.from('voice_draft_notes')
        .update({ status: 'ERROR', followup_question: 'Wykryto niedozwolone słownictwo w wygenerowanym raporcie. Wymagana weryfikacja personelu.' })
        .eq('id', draft.id)
      return NextResponse.json({ error: 'Naruszenie słownika MDR w generowanym raporcie' }, { status: 422 })
    }

    // 5. Zapis szkicu do daily_reports z polami AI provenance
    const { error: insertReportError } = await supabase.from('daily_reports').insert({
      resident_id: draft.resident_id,
      author_id: user.id,
      content: { text: reportText },
      status: 'DRAFT',
      ai_generated: true,
      ai_model: process.env.EU_LLM_MODEL || 'mistral-small-latest',
      ai_prompt_version: '2.0.0',
      ai_generated_at: new Date().toISOString()
    })

    if (insertReportError) {
      console.error('Draft error: Database insert failed')
      return NextResponse.json({ error: 'Błąd zapisu raportu' }, { status: 500 })
    }

    // 6. Aktualizacja draftu
    await supabase.from('voice_draft_notes')
      .update({ status: 'PROCESSED', followup_question: null })
      .eq('id', draft.id)

    return NextResponse.json({ success: true, report: reportText })
  } catch (error: unknown) {
    console.error('Process Error: An unexpected error occurred')
    const errMsg = error instanceof Error ? error.message : 'Wystąpił nieoczekiwany błąd'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
