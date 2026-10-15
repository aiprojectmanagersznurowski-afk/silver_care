import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limiter'
import { transcribeWithGroq } from '@/lib/voice-helpers'
import type { TablesInsert, TablesUpdate } from '@/types/database.types'

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
    const file = formData.get('file') as File | null
    const residentId = formData.get('resident_id') as string | null
    const draftId = formData.get('draft_id') as string | null
    const clientUuid = formData.get('client_uuid') as string | null

    if (!file || !(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: 'Brak pliku dźwiękowego' }, { status: 400 })
    }

    // Monitor Groq rate limits (INFRA-GROQ-TRANSCRIPTION: 2000 req/day, 8h audio/day)
    console.log('[INFRA-GROQ-TRANSCRIPTION] Audio conversion request dispatched')

    // --- KROK 1: Transkrypcja audio (STT) przez Groq Whisper ---
    let transcription = ''
    try {
      const sttResult = await transcribeWithGroq(file, apiKey)
      transcription = sttResult.text
    } catch (err: unknown) {
      const status =
        typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status: unknown }).status === 'number'
          ? (err as { status: number }).status
          : 502
      const message = err instanceof Error ? err.message : 'Błąd podczas transkrypcji Groq'
      return NextResponse.json({ error: message }, { status })
    }

    // Jeśli brak resident_id (np. czat personelu lub czysty test STT), zwracamy sam wynik transkrypcji
    if (!residentId) {
      return NextResponse.json({
        success: true,
        text: transcription,
        transcript: transcription,
      })
    }

    // --- KROK 2: Opcjonalny zapis szkicu w voice_draft_notes ---
    let finalDraftId = draftId
    let finalTranscript = transcription

    if (draftId) {
      const { data: oldDraft } = await supabase
        .from('voice_draft_notes')
        .select('transcript')
        .eq('id', draftId)
        .single()

      const oldText = (oldDraft?.transcript || '').trim()
      finalTranscript = oldText
        ? `${oldText}\n\n[UZUPEŁNIENIE:] ${transcription}`
        : transcription

      const draftUpdate: TablesUpdate<'voice_draft_notes'> = {
        transcript: finalTranscript,
        status: 'DRAFT',
        followup_question: null,
      }

      const { error: updateError } = await supabase
        .from('voice_draft_notes')
        .update(draftUpdate)
        .eq('id', draftId)

      if (updateError) {
        return NextResponse.json({ error: 'Błąd aktualizacji transkrypcji' }, { status: 500 })
      }
    } else {
      const draftInsert: TablesInsert<'voice_draft_notes'> = {
        resident_id: residentId,
        nurse_id: user.id,
        transcript: transcription,
        audio_url: 'local-only',
        client_uuid: clientUuid,
      }

      const { data: dbData, error: dbError } = await supabase
        .from('voice_draft_notes')
        .insert(draftInsert)
        .select('id')
        .single()

      if (dbError || !dbData) {
        return NextResponse.json(
          { error: 'Błąd podczas zapisu transkrypcji do bazy (np. zduplikowany client_uuid dla offline)' },
          { status: 500 }
        )
      }
      finalDraftId = dbData.id
    }

    return NextResponse.json({
      success: true,
      text: finalTranscript,
      transcript: finalTranscript,
      newChunk: transcription,
      draftId: finalDraftId,
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Wystąpił nieoczekiwany błąd'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
