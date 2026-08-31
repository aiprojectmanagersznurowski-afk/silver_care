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
      const err = await response.text()
      console.error('Groq API Error:', err)
      return NextResponse.json({ error: 'Błąd podczas transkrypcji Groq' }, { status: 500 })
    }

    const result = await response.json()
    const transcription = result.text

    // Zapisujemy draft (brudnopis) w naszej bazie
    // Faza 3: "Voice notes — nagrywanie + transkrypcja"
    const { error: dbError } = await supabase
      .from('voice_draft_notes')
      .insert({
        resident_id: residentId,
        nurse_id: user.id,
        transcription: transcription,
        raw_audio_path: 'local-only', // Na MVP nie trzymamy audio, od razu przetwarzamy (wymóg Zero Retention)
      })

    if (dbError) {
      console.error('DB Error:', dbError)
      return NextResponse.json({ error: 'Błąd podczas zapisu transkrypcji do bazy' }, { status: 500 })
    }

    return NextResponse.json({ success: true, text: transcription })

  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
