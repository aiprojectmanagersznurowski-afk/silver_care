import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isImpersonationSessionActive } from '@/lib/impersonation-guards'
import { callEuLlmCompletion } from '@/lib/eu-llm-client'
import { extractJson } from '@/lib/voice-helpers'
import { validateReportText } from '@silvercare/contracts/src/validation'
import { AI_DISCLOSURE_LABEL } from '@silvercare/contracts/src/generated/presentation'
import { 
  redactVoiceTranscript, 
  validateVoiceDraftInput, 
  buildClassifierSystemPrompt,
  buildFamilyReportSystemPrompt,
  sanitizeReportAndVerifySafety
} from '@/lib/voice-redactor'
import type { Json } from '@/types/database.types'

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

    // Europejski LLM w EOG (Krok 1: Klasyfikator i Redakcja Medyczna)
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

    // Połączenie parametrów medycznych z deterministycznego filtra do strumienia personelu
    if (extractedMedical.length > 0) {
      const allMed = [...extractedMedical, ...(classified.medical ? [classified.medical] : [])]
      classified.medical = allMed.join('; ')
    }

    // 3. Idempotentny zapis do daily_logs (dane medyczne dla personelu — brudnopis)
    const { data: existingLog } = await supabase
      .from('daily_logs')
      .select('id')
      .eq('resident_id', draft.resident_id)
      .contains('data', { draft_id: draft.id })
      .maybeSingle()

    if (!existingLog) {
      const logPayload = { ...(classified as unknown as Record<string, unknown>), draft_id: draft.id }
      const { error: logError } = await supabase.from('daily_logs').insert({
        resident_id: draft.resident_id,
        nurse_id: user.id,
        data: logPayload as unknown as Json
      })
      if (logError) {
        return NextResponse.json({ error: 'Błąd zapisu logów personelu' }, { status: 500 })
      }
    }

    // 4. GENERATE (Krok 2: Raport dla Bliskich) — ETAP REDACT: classified.medical ZOSTANIE POMINIĘTY
    const userPrompt2 = `Informacje o zachowaniu: ${classified.behavioral || 'Brak szczególnych uwag'}\nInformacje o dyskomforcie: ${classified.discomfort || 'Brak'}`

    const raw2 = await callEuLlmCompletion([
      { role: 'system', content: buildFamilyReportSystemPrompt() },
      { role: 'user', content: userPrompt2 }
    ], 0.4, 600)

    // Weryfikacja bezpieczeństwa (MDR-NO-INTERPRETATION: validateReportText, AI Act: AI_DISCLOSURE_LABEL)
    const _mdr = validateReportText(raw2)
    const { reportText: safeText, requiresStaffReview } = sanitizeReportAndVerifySafety(raw2)
    const reportText = safeText.includes(AI_DISCLOSURE_LABEL) ? safeText : `${safeText}\n\n${AI_DISCLOSURE_LABEL}`

    // 5. REJOIN: Złączenie z tożsamością pensjonariusza i idempotentny zapis szkicu do daily_reports
    const { data: existingReport } = await supabase
      .from('daily_reports')
      .select('id')
      .eq('resident_id', draft.resident_id)
      .contains('content', { draft_id: draft.id })
      .maybeSingle()

    const reportContent = {
      text: reportText,
      draft_id: draft.id,
      requires_staff_review: requiresStaffReview,
    }

    if (existingReport) {
      await supabase.from('daily_reports').update({
        content: reportContent,
        status: 'DRAFT',
        updated_at: new Date().toISOString(),
      }).eq('id', existingReport.id)
    } else {
      const { error: insertReportError } = await supabase.from('daily_reports').insert({
        resident_id: draft.resident_id,
        author_id: user.id,
        content: reportContent,
        status: 'DRAFT',
        ai_generated: true,
        ai_model: REPORT_LLM_MODEL,
        ai_prompt_version: 'v2.0.0-mdr-compliant',
        ai_generated_at: new Date().toISOString()
      })

      if (insertReportError) {
        return NextResponse.json({ error: 'Błąd zapisu raportu' }, { status: 500 })
      }
    }

    // 6. Aktualizacja draftu
    await supabase.from('voice_draft_notes')
      .update({ status: 'PROCESSED', followup_question: null })
      .eq('id', draft.id)

    return NextResponse.json({ 
      success: true, 
      report: reportText, 
      requires_staff_review: requiresStaffReview 
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Wystąpił nieoczekiwany błąd'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
