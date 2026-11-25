import { isOrgFeatureEnabled } from '@/lib/feature-flags'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { callEuLlmCompletion } from '@/lib/eu-llm-client'
import { extractJson } from '@/lib/voice-helpers'
import { NO_FAMILY_REPORT_DATA, VOICE_PROMPT_VERSION } from '@silvercare/contracts/src/prompts'
import { 
  redactVoiceTranscript, 
  validateVoiceDraftInput, 
  buildClassifierSystemPrompt,
  buildFamilyReportSystemPrompt,
  buildFamilyReportInput,
  sanitizeReportAndVerifySafety,
  MedicationEvent,
} from '@/lib/voice-redactor'
import { saveProcessedVoiceDraft } from '@/lib/voice-process-persistence'
import { omitVoiceTaskCompletion } from '@/lib/voice-shift-task-completion'
import { SHIFT_TASK_VOICE } from '@silvercare/contracts/src/generated/roles'
import { readSpeechConfiguration, redactPrivately } from '@/lib/voice-private-speech'

export const runtime = 'nodejs'

const REPORT_LLM_MODEL = process.env.REPORT_LLM_MODEL || process.env.EU_LLM_MODEL || 'mistralai/mistral-small-24b-instruct-2501'

export const POST = withAuth(async (req, { supabase, user }) => {
  try {
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
        taskNote: reportText === null && omitVoiceTaskCompletion(draft.transcript ?? '') === '',
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
    const { cleanedTranscript: redacted, extractedMedical } = redactVoiceTranscript(transcription)
    const remaining = omitVoiceTaskCompletion(redacted)
    const tasksEnabled = remaining !== redacted.trim()
      && await isOrgFeatureEnabled(supabase, user.organizationId, SHIFT_TASK_VOICE.requiredFeatures[1])
    const cleanedTranscript = tasksEnabled ? remaining : redacted
    if (tasksEnabled && !cleanedTranscript && !extractedMedical.length) {
      const { error } = await supabase.from('voice_draft_notes')
        .update({ status: 'PROCESSED', updated_at: new Date().toISOString(), followup_question: null })
        .eq('id', draft.id).eq('nurse_id', user.id).neq('status', 'PROCESSED')
      if (error) return NextResponse.json({ error: 'Nie udało się przetworzyć notatki o zadaniach.' }, { status: 500 })
      return NextResponse.json({ success: true, taskNote: true, report: null })
    }

    let reportInput = ''
    if (cleanedTranscript.trim()) {
      try {
        const privateText = await redactPrivately(readSpeechConfiguration(), cleanedTranscript)
        reportInput = redactVoiceTranscript(privateText).cleanedTranscript.trim()
      } catch {
        return NextResponse.json({ error: 'Redakcja nagrania jest chwilowo niedostępna. Szkic został zachowany.' }, { status: 503 })
      }
    }
    const raw1 = reportInput ? await callEuLlmCompletion([
      { role: 'system', content: buildClassifierSystemPrompt() },
      { role: 'user', content: reportInput },
    ], 0.1, 800) : '{}'
    const classified = extractJson(raw1)

    if (classified._parseError) {
      await supabase.from('voice_draft_notes')
        .update({ status: 'ERROR', followup_question: 'Wystąpił błąd klasyfikacji notatki. Prosimy o ponowne nagranie.' })
        .eq('id', draft.id)

      return NextResponse.json({ 
        success: false, 
        error: 'Nie udało się przetworzyć struktury notatki (błąd techniczny klasyfikatora AI). Ze względów bezpieczeństwa (ADR-007) dane nie zostały przekazane do generatora raportu. Spróbuj zatwierdzić ponownie lub doprecyzuj treść w polu tekstowym.' 
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
    const reportFacts = buildFamilyReportInput(classified)
    const raw2 = reportFacts
      ? await callEuLlmCompletion([
        { role: 'system', content: buildFamilyReportSystemPrompt() },
        { role: 'user', content: reportFacts },
      ], 0.4, 600)
      : NO_FAMILY_REPORT_DATA

    // Weryfikacja bezpieczeństwa (MDR-NO-INTERPRETATION, AI Act) — dane o lekach należą do strumienia MEDICAL (wyłącznie daily_logs)
    const { reportText: finalText, requiresStaffReview } = sanitizeReportAndVerifySafety(raw2)

    const reportContent = {
      text: finalText,
      draft_id: draft.id,
      requires_staff_review: requiresStaffReview,
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
}, { roles: ['nurse'], requireOrganization: true, blockImpersonation: true, requiredFeature: 'module_voice_and_reports' })
