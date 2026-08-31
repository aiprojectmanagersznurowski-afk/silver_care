import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { draftId } = await req.json()
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

    const transcription = draft.transcription || ''

    // 2. Groq LLM (Krok 1: Klasyfikator i Redaktor)
    // Model: llama3-70b-8192 for high quality parsing, JSON mode
    const systemPrompt1 = `Przeanalizuj poniższy transkrypt z opieki nad podopiecznym. 
Podziel informacje na 3 kategorie i zwróć DOKŁADNIE TEN FORMAT JSON (bez znaczników markdown, czysty JSON):
{
  "medical": "leki, rozpoznania chorobowe, wyniki badań, parametry życiowe, dawki (albo null jeśli brak)",
  "discomfort": "wymioty, biegunka, nietrzymanie - opisz bardzo ogólnie (albo null jeśli brak)",
  "behavioral": "zachowanie, nastrój, apetyt, udział w zajęciach, sen (albo null jeśli brak)"
}
Nie dopisuj komentarzy, tylko surowy, poprawny JSON.`

    const resp1 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-27b', // using available model for this API key
        response_format: { type: "json_object" },
        messages: [
          { role: 'system', content: systemPrompt1 },
          { role: 'user', content: transcription }
        ],
        temperature: 0.1
      })
    })

    if (!resp1.ok) {
       console.error("Groq Step 1 Error:", await resp1.text())
       return NextResponse.json({ error: 'Błąd klasyfikacji AI' }, { status: 500 })
    }

    const json1 = await resp1.json()
    const content1 = json1.choices[0].message.content
    let classified;
    try {
       classified = JSON.parse(content1)
    } catch(e) {
       console.error("Failed to parse JSON:", content1)
       return NextResponse.json({ error: 'Błąd parsowania AI' }, { status: 500 })
    }

    // 3. Zapis do daily_logs (dane medyczne dla pielęgniarki)
    const { error: logError } = await supabase.from('daily_logs').insert({
       resident_id: draft.resident_id,
       nurse_id: user.id,
       data: classified // Zapisujemy całe zredagowane JSON
    })
    
    if (logError) {
      console.error("Log error: Database insert failed")
      return NextResponse.json({ error: 'Błąd zapisu logów' }, { status: 500 })
    }

    // 4. Groq LLM (Krok 2: Generator Raportu)
    const systemPrompt2 = `Jesteś empatycznym asystentem w domu opieki. 
Na podstawie poniższych strzępków informacji napisz krótki, pozytywny i ciepły raport (ok. 2-3 zdania) dla rodziny podopiecznego, podsumowujący jego dzień.
Używaj formy bezosobowej lub zwrotów typu "Twój bliski", ponieważ nie znasz jego imienia (zachowaj anonimowość).
Zabronione jest wymienianie nazw leków czy rozpoznań medycznych. 
Jeśli wystąpił dyskomfort, wspomnij o nim łagodnie (np. "Wystąpiły drobne problemy trawienne, którymi się zaopiekowaliśmy").
Jeśli informacje są puste (null) w obu kategoriach, napisz po prostu, że to był spokojny dzień bez większych zmian.`

    const userPrompt2 = `Informacje o zachowaniu: ${classified.behavioral}
Informacje o dyskomforcie: ${classified.discomfort}`

    const resp2 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-27b',
        messages: [
          { role: 'system', content: systemPrompt2 },
          { role: 'user', content: userPrompt2 }
        ],
        temperature: 0.5
      })
    })

    if (!resp2.ok) {
       console.error("Groq Step 2 Error: API returned error")
       return NextResponse.json({ error: 'Błąd generowania raportu AI' }, { status: 500 })
    }

    const json2 = await resp2.json()
    const reportText = json2.choices[0].message.content

    // 5. Zapis szkicu do daily_reports
    const { error: reportError } = await supabase.from('daily_reports').insert({
       resident_id: draft.resident_id,
       author_id: user.id,
       content: { text: reportText },
       status: 'DRAFT',
       ai_generated: true
    })

    if (reportError) {
       console.error("Report error: Database insert failed")
       return NextResponse.json({ error: 'Błąd zapisu raportu' }, { status: 500 })
    }

    // 6. Aktualizacja draftu
    await supabase.from('voice_draft_notes')
       .update({ status: 'PROCESSED' })
       .eq('id', draft.id)

    return NextResponse.json({ success: true, report: reportText })
  } catch (error: any) {
    console.error('Process Error: An unexpected error occurred')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
