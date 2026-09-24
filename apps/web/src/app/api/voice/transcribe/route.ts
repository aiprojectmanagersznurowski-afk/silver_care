import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limiter'

// Domyślnie body parser jest wyłączony, żeby można było pobrać form data z plikiem
export const runtime = 'nodejs'

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

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1'
    const rateCheck = checkRateLimit(`transcribe:${user.id || ip}`, 30, 60000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Przekroczono limit zapytań transkrypcji audio (max 30/min)' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) } }
      )
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Brak konfiguracji GROQ_API_KEY' }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const residentId = formData.get('resident_id') as string | null
    const draftId = formData.get('draft_id') as string | null
    const clientUuid = formData.get('client_uuid') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Brak pliku dźwiękowego' }, { status: 400 })
    }

    // Monitor Groq rate limits (INFRA-GROQ-TRANSCRIPTION: 2000 req/day, 8h audio/day)
    console.log('[INFRA-GROQ-TRANSCRIPTION] Audio conversion request dispatched')

    // Wywołanie Groq API do transkrypcji (Whisper-large-v3)
    const groqFormData = new FormData()
    const filename = file.name || 'recording.webm'
    groqFormData.append('file', file, filename)
    groqFormData.append('model', 'whisper-large-v3')
    groqFormData.append('language', 'pl') // wymuszamy polski, żeby poprawić skuteczność na MVP

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: groqFormData
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
      return NextResponse.json({ error: parsedMsg }, { status: response.status || 500 })
    }

    const result = await response.json()
    const transcription = (result.text || '').trim()

    if (!residentId) {
      return NextResponse.json({
        success: true,
        text: transcription,
      })
    }

    let finalDraftId = draftId
    let finalTranscript = transcription

    if (draftId) {
      // Pobieramy stary draft i dopisujemy nowy tekst
      const { data: oldDraft } = await supabase
        .from('voice_draft_notes')
        .select('transcript')
        .eq('id', draftId)
        .single()
        
      const oldText = (oldDraft?.transcript || '').trim()
      finalTranscript = oldText
        ? `${oldText}\n\n[UZUPEŁNIENIE:] ${transcription}`
        : transcription

      const { error: updateError } = await supabase
        .from('voice_draft_notes')
        .update({
          transcript: finalTranscript,
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
        return NextResponse.json({ error: 'Błąd podczas zapisu transkrypcji do bazy (np. zduplikowany client_uuid dla offline)' }, { status: 500 })
      }
      finalDraftId = dbData.id
    }

    // Zwracamy połączony pełny tekst notatki, aby frontend i kolejny krok AI miały pełen kontekst
    return NextResponse.json({
      success: true,
      text: finalTranscript,
      newChunk: transcription,
      draftId: finalDraftId
    })

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Wystąpił nieoczekiwany błąd'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
