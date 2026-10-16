import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isImpersonationSessionActive } from '@/lib/impersonation-guards'
import { callEuLlmCompletion } from '@/lib/eu-llm-client'
import { extractJson } from '@/lib/voice-helpers'
import { AI_DISCLOSURE_LABEL } from '@silvercare/contracts/src/generated/presentation'
import { VOICE_PROMPT_VERSION } from '@silvercare/contracts/src/prompts'
import { 
  redactVoiceTranscript, 
  validateVoiceDraftInput, 
  buildClassifierSystemPrompt,
  buildFamilyReportSystemPrompt,
  sanitizeReportAndVerifySafety,
  resolveMedicationTemplate,
  MedicationEvent,
} from '@/lib/voice-redactor'
import { saveProcessedVoiceDraft } from '@/lib/voice-process-persistence'

export const runtime = 'nodejs'

const REPORT_LLM_MODEL = process.env.REPORT_LLM_MODEL || process.env.EU_LLM_MODEL || 'mistralai/mistral-small-24b-instruct-2501'

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

    const cookieStore = await cookies()
    if (isImpersonationSessionActive(cookieStore, user)) {
      return NextResponse.json({ error: 'Operacja niedozwolona w trybie podglądu' }, { status: 403 })
    }

    const role = user.app_metadata?.role as string | undefined
    if (role === 'family') {
      return NextResponse.json({ error: 'Brak uprawnień personelu' }, { status: 403 })
    }

    const { draftId, editedTranscription } = await req.json()
    if (!draftId) {
      return NextResponse.json({ error: 'Brak draftId' }, { status: 400 })
    }

    // 1. Pobranie i walidacja szkicu (VOICE-ZERO-GUESSING)
    const { data: draft, error: draftError } = await supabase
      .from('voice_draft_notes')
      .select('*')
      .eq('id', draftId)
      .single()

    if (draftError || !draft) {
      return NextResponse.json({ error: 'Nie znaleziono notatki' }, { status: 404 })
    }

    const draftValidation = validateVoiceDraftInput(draft)
    if (!draftValidation.valid) {
      return NextResponse.json({ error: draftValidation.error }, { status: 400 })
    }

    // Idempotencja: ponowienie dla przetworzonego szkicu zwraca istniejący raport
    if (draft.status === 'PROCESSED') {
      const { data: existingReport } = await supabase
        .from('daily_reports')
        .select('content')
        .eq('resident_id', draft.resident_id)
        .contains('content', { draft_id: draft.id })
        .maybeSingle()

      const reportText = typeof (existingReport?.content as { text?: string })?.text === 'string'
        ? (existingReport?.content as { text: string }).text
        : null

      return NextResponse.json({
        success: true,
        report: reportText,
        idempotent: true,
        message: 'Notatka została już przetworzona (idempotent)',
      })
    }

    const transcription = (typeof editedTranscription === 'string' && editedTranscription.trim() !== '')
      ? editedTranscription.trim()
      : (draft.transcript || '').trim()

    if (!transcription) {
      return NextResponse.json({ error: 'Brak treści transkrypcji do przetworzenia' }, { status: 400 })
    }

    if (typeof editedTranscription === 'string' && editedTranscription.trim() !== '' && editedTranscription !== draft.transcript) {
      await supabase.from('voice_draft_notes').update({ transcript: editedTranscription.trim() }).eq('id', draft.id)
    }

    // 2. Pre-LLM Redaction (ADR-007 & VOICE-MEDICAL-STRIP): Odcięcie PII i parametrów PRZED LLM
    const { cleanedTranscript, extractedMedical } = redactVoiceTranscript(transcription)

    // Europejski LLM w EOG (Krok 1: Klasyfikator i Redakcja Medyczna ze strukturą medication_event)
    const raw1 = await callEuLlmCompletion([
      { role: 'system', content: buildClassifierSystemPrompt() },
      { role: 'user', content: cleanedTranscript }
    ], 0.1, 800)

    const classified = extractJson(raw1, cleanedTranscript)

    if (classified._parseError) {
      await supabase.from('voice_draft_notes')
        .update({ status: 'ERROR', followup_question: 'Wystąpił błąd klasyfikacji notatki. Prosimy o ponowne nagranie.' })
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
        .update({ status: 'NEEDS_FOLLOWUP', followup_question: q })
        .eq('id', draft.id)

      return NextResponse.json({ success: true, needsFollowup: true, question: q })
    }

    // Struktura medication_event i alerty dla personelu
    const rawMedEvent = classified.medication_event
    const medEvent: MedicationEvent = (rawMedEvent === 'taken' || rawMedEvent === 'refused' || rawMedEvent === 'missed')
      ? rawMedEvent
      : 'none'
    const requiresMedConfirmation = medEvent === 'refused' || medEvent === 'missed'

    // Połączenie parametrów medycznych z deterministycznego filtra do strumienia personelu
    if (extractedMedical.length > 0) {
      const allMed = [...extractedMedical, ...(classified.medical ? [classified.medical] : [])]
      classified.medical = allMed.join('; ')
    }

    const logPayload = {
      ...(classified as unknown as Record<string, unknown>),
      draft_id: draft.id,
      medication_event: medEvent,
      medication_alert_requires_confirmation: requiresMedConfirmation,
    }

    // 3. GENERATE (Krok 2: Raport dla Bliskich) — ETAP REDACT: classified.medical ZOSTANIE POMINIĘTY
    const userPrompt2 = `Informacje o zachowaniu: ${classified.behavioral || 'Brak szczególnych uwag'}\nInformacje o dyskomforcie: ${classified.discomfort || 'Brak'}`

    const raw2 = await callEuLlmCompletion([
      { role: 'system', content: buildFamilyReportSystemPrompt() },
      { role: 'user', content: userPrompt2 }
    ], 0.4, 600)

    // Weryfikacja bezpieczeństwa (MDR-NO-INTERPRETATION, AI Act)
    const { reportText: safeBaseText, requiresStaffReview } = sanitizeReportAndVerifySafety(raw2)

    // Dołączenie deterministycznego szablonu lekowego (bez nazw leków, dawek i liczb)
    const medTemplate = resolveMedicationTemplate(medEvent)
    let finalText = safeBaseText
    if (medTemplate && !requiresStaffReview) {
      const parts = finalText.split(AI_DISCLOSURE_LABEL)
      finalText = `${parts[0].trim()}\n\n${medTemplate}\n\n${AI_DISCLOSURE_LABEL}`
    }

    const reportContent = {
      text: finalText,
      draft_id: draft.id,
      requires_staff_review: requiresStaffReview,
      medication_event: medEvent,
      medication_alert_requires_confirmation: requiresMedConfirmation,
    }

    // 4. ATOMIC PERSISTENCE (RPC PostgreSQL + rollback kompensacyjny)
    const persistRes = await saveProcessedVoiceDraft(supabase, {
      draftId: draft.id,
      residentId: draft.resident_id,
      nurseId: user.id,
      dailyLogData: logPayload,
      reportContent,
      aiModel: REPORT_LLM_MODEL,
      aiPromptVersion: VOICE_PROMPT_VERSION,
      aiGeneratedAt: new Date().toISOString(),
    })

    if (!persistRes.success) {
      return NextResponse.json({ error: persistRes.error || 'Błąd zapisu raportu' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      report: finalText, 
      requires_staff_review: requiresStaffReview,
      medication_event: medEvent,
      medication_alert_requires_confirmation: requiresMedConfirmation,
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Wystąpił nieoczekiwany błąd'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
