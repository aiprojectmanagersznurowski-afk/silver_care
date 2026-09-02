import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Domyślnie body parser jest wyłączony, żeby można było pobrać form data z plikiem
export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const residentId = formData.get('resident_id') as string
    const draftId = formData.get('draft_id') as string | null
    const clientUuid = formData.get('client_uuid') as string | null

    if (!file || !residentId) {
      return NextResponse.json({ error: 'Brak pliku lub id pensjonariusza' }, { status: 400 })
    }

    // Wywołanie Groq API do transkrypcji (Whisper-large-v3)
    const groqFormData = new FormData()
    groqFormData.append('file', file)
    groqFormData.append('model', 'whisper-large-v3')
    groqFormData.append('language', 'pl') // wymuszamy polski, żeby poprawić skuteczność na MVP

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: groqFormData
    })

    if (!response.ok) {
      console.error('Groq API Error: API returned error')
      return NextResponse.json({ error: 'Błąd podczas transkrypcji Groq' }, { status: 500 })
    }

    const result = await response.json()
    const transcription = result.text

    let finalDraftId = draftId

    if (draftId) {
      // Pobieramy stary draft i dopisujemy nowy tekst
      const { data: oldDraft } = await supabase
        .from('voice_draft_notes')
        .select('transcript')
        .eq('id', draftId)
        .single()
        
      const newTranscript = (oldDraft?.transcript || '') + '\n[UZUPEŁNIENIE:] ' + transcription

      const { error: updateError } = await supabase
        .from('voice_draft_notes')
        .update({
          transcript: newTranscript,
          status: 'DRAFT',
          followup_question: null
        })
        .eq('id', draftId)

      if (updateError) {
        return NextResponse.json({ error: 'Błąd aktualizacji transkrypcji' }, { status: 500 })
      }
    } else {
      // Tworzymy nowy wpis
      const { data: dbData, error: dbError } = await supabase
        .from('voice_draft_notes')
        .insert({
          resident_id: residentId,
          nurse_id: user.id,
          transcript: transcription,
          audio_url: 'local-only', 
          client_uuid: clientUuid
        })
        .select('id')
        .single()

      if (dbError || !dbData) {
        console.error('DB Error: Database insert failed', dbError)
        return NextResponse.json({ error: 'Błąd podczas zapisu transkrypcji do bazy (np. zduplikowany client_uuid dla offline)' }, { status: 500 })
      }
      finalDraftId = dbData.id
    }

    // Zwracamy sam text z obecnego wysłanego pliku w polu text, dla podglądu, chociaż w drafcie jest połączony.
    return NextResponse.json({ success: true, text: transcription, draftId: finalDraftId })

  } catch (error: any) {
    console.error('Error: An unexpected error occurred')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
