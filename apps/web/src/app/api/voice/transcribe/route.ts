import { createHash } from 'node:crypto'
import { SHIFT_TASK_VOICE } from '@silvercare/contracts/src/generated/roles'
import { staffMfaSatisfied } from '@/lib/auth/staff-mfa'
import { assertOrgFeatureForApi } from '@/lib/feature-flags'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppOrganizationId, getAppRole } from '@/lib/auth/app-role'
import { isVoiceRealDataPilot } from '@/lib/eu-llm-client'
import { checkRateLimit } from '@/lib/rate-limiter'
import { transcribeWithGroq } from '@/lib/voice-helpers'
import type { TablesInsert, TablesUpdate } from '@/types/database.types'

export const runtime = 'nodejs'

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

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

    const role = getAppRole(user)
    if (role !== 'nurse' && role !== 'org_admin') {
      return NextResponse.json({ error: 'Brak uprawnień do transkrypcji.' }, { status: 403 })
    }
    const { data: session } = await supabase.auth.getClaims(token)
    if (session?.claims.sub !== user.id || !await staffMfaSatisfied(supabase, session.claims.aal, SHIFT_TASK_VOICE.requiredAal)) {
      return NextResponse.json({ error: 'Potwierdź drugi składnik uwierzytelniania.' }, { status: 403 })
    }

    const featureDenied = await assertOrgFeatureForApi(supabase, user, '/api/voice/transcribe')
    if (featureDenied) return featureDenied

    if (isVoiceRealDataPilot()) {
      return NextResponse.json(
        { error: 'Starsza transkrypcja jest wyłączona w trybie pilotażu.' },
        { status: 503 },
      )
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
    const recordedValue = formData.get('recorded_at')
    const recordedAt = typeof recordedValue === 'string' ? Date.parse(recordedValue) : NaN
    const hasRecordingTime = Number.isFinite(recordedAt) && recordedAt <= Date.now() + 60_000

    if (!file || !(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: 'Brak pliku dźwiękowego' }, { status: 400 })
    }

    if ((residentId !== null && (typeof residentId !== 'string' || !uuid.test(residentId)))
      || (draftId !== null && (!residentId || typeof draftId !== 'string' || !uuid.test(draftId)))) {
      return NextResponse.json({ error: 'Nieprawidłowe powiązanie nagrania.' }, { status: 400 })
    }
    if (residentId) {
      const orgId = getAppOrganizationId(user)
      if (!orgId) return NextResponse.json({ error: 'Brak przypisanej placówki.' }, { status: 403 })
      const { data: resident, error } = await supabase.from('residents').select('id')
        .match({ id: residentId, organization_id: orgId }).is('archived_at', null).maybeSingle()
      if (error || !resident) return NextResponse.json({ error: 'Podopieczny jest niedostępny w tej placówce.' }, { status: 403 })
    }

    const draftScope = draftId && residentId ? { id: draftId, resident_id: residentId, nurse_id: user.id } : null
    let previousTranscript = ''
    if (draftScope) {
      const { data: draft, error } = await supabase.from('voice_draft_notes').select('transcript')
        .match(draftScope).neq('status', 'PROCESSED').maybeSingle()
      if (error || !draft) return NextResponse.json({ error: 'Szkic jest niedostępny do uzupełnienia.' }, { status: 403 })
      previousTranscript = (draft.transcript || '').trim()
    }

    // Monitor Groq rate limits (INFRA-GROQ-TRANSCRIPTION: 2000 req/day, 8h audio/day)
    console.log('[INFRA-GROQ-TRANSCRIPTION] Audio conversion request dispatched')

    // --- KROK 1: Transkrypcja audio (STT) przez Groq Whisper ---
    let transcription = ''
    try {
      const sttResult = await transcribeWithGroq(file, apiKey)
      transcription = sttResult.text.trim()
    } catch (err: unknown) {
      const status =
        typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status: unknown }).status === 'number'
          ? (err as { status: number }).status
          : 502
      return NextResponse.json({ error: 'Nie udało się przetranskrybować nagrania.' }, { status })
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

    if (draftScope) {
      finalTranscript = previousTranscript
        ? `${previousTranscript}\n\n[UZUPEŁNIENIE:] ${transcription}`
        : transcription

      const draftUpdate: TablesUpdate<'voice_draft_notes'> = {
        transcript: finalTranscript,
        status: 'DRAFT',
        followup_question: null,
      }

      const { data: updated, error: updateError } = await supabase
        .from('voice_draft_notes')
        .update(draftUpdate)
        .match(draftScope).neq('status', 'PROCESSED').select('id').maybeSingle()

      if (updateError) {
        return NextResponse.json({ error: 'Błąd aktualizacji transkrypcji' }, { status: 500 })
      }
      if (!updated) return NextResponse.json({ error: 'Szkic zmienił się w czasie transkrypcji.' }, { status: 409 })
    } else {
      const canRegisterAudio = typeof clientUuid === 'string' && uuid.test(clientUuid) && uuid.test(residentId)
        && hasRecordingTime && role === 'nurse'
      if (clientUuid && canRegisterAudio) {
        const { data, error } = await createAdminClient().rpc('record_app_voice_task_draft', {
          p_author_id: user.id, p_resident_id: residentId, p_client_uuid: clientUuid, p_transcript: transcription,
          p_recorded_at: new Date(recordedAt).toISOString(),
          p_audio_hash: createHash('sha256').update(new Uint8Array(await file.arrayBuffer())).digest('hex'),
        })
        if (error || !data || typeof data !== 'object' || Array.isArray(data)
          || typeof data.draft_id !== 'string' || typeof data.transcript !== 'string') {
          return NextResponse.json({ error: 'Nie udało się potwierdzić zapisu nagrania.' }, {
            status: error?.code === '23505' ? 409 : error?.code === '42501' ? 403 : 503,
          })
        }
        return NextResponse.json({ success: true, text: data.transcript, transcript: data.transcript, newChunk: transcription, draftId: data.draft_id })
      }
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
