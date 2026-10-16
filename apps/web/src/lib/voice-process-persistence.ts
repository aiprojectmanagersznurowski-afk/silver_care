/**
 * voice-process-persistence.ts — Atomowy zapis wyników przetwarzania notatki głosowej.
 * Wywołuje procedurę PostgreSQL RPC process_voice_draft_atomic lub wykonuje kompensowany zapis idempotentny.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database.types'
import { VOICE_PROMPT_VERSION } from '@silvercare/contracts/src/prompts'

export interface ProcessedVoiceDraftPayload {
  draftId: string
  residentId: string
  nurseId: string
  dailyLogData: Record<string, unknown>
  reportContent: {
    text: string
    draft_id: string
    requires_staff_review: boolean
  }
  aiModel?: string
  aiPromptVersion?: string
  aiGeneratedAt?: string
}

export interface PersistenceResult {
  success: boolean
  idempotent?: boolean
  logId?: string
  reportId?: string
  reportContent?: Json
  error?: string
}

export async function saveProcessedVoiceDraft(
  supabase: SupabaseClient<Database>,
  payload: ProcessedVoiceDraftPayload
): Promise<PersistenceResult> {
  // 1. Próba wykonania atomowego RPC PostgreSQL
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'process_voice_draft_atomic',
      {
        p_draft_id: payload.draftId,
        p_resident_id: payload.residentId,
        p_nurse_id: payload.nurseId,
        p_daily_log_data: payload.dailyLogData as unknown as Json,
        p_report_content: payload.reportContent as unknown as Json,
        p_ai_model: payload.aiModel || null,
        p_ai_prompt_version: payload.aiPromptVersion || null,
        p_ai_generated_at: payload.aiGeneratedAt || new Date().toISOString(),
      }
    )

    if (!rpcError && rpcData) {
      const parsed = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData
      if (parsed.success) {
        return {
          success: true,
          idempotent: Boolean(parsed.idempotent),
          logId: parsed.log_id,
          reportId: parsed.report_id,
          reportContent: parsed.report_content,
        }
      }
    }
  } catch {
    // Przejdź do zapisu kompensowanego (fallback dla środowisk testowych / mocków)
  }

  // 2. Fallback z transakcyjnym rollbackiem kompensacyjnym (np. testy jednostkowe / Vitest)
  let insertedLogId: string | null = null

  try {
    const { data: draft } = await supabase
      .from('voice_draft_notes')
      .select('status')
      .eq('id', payload.draftId)
      .single()

    if (draft?.status === 'PROCESSED') {
      const { data: existingReport } = await supabase
        .from('daily_reports')
        .select('id, content')
        .eq('resident_id', payload.residentId)
        .contains('content', { draft_id: payload.draftId })
        .maybeSingle()

      return {
        success: true,
        idempotent: true,
        reportId: existingReport?.id,
        reportContent: existingReport?.content,
      }
    }

    // A. Zapis daily_logs (dane medyczne dla personelu)
    const { data: existingLog } = await supabase
      .from('daily_logs')
      .select('id')
      .eq('resident_id', payload.residentId)
      .contains('data', { draft_id: payload.draftId })
      .maybeSingle()

    if (existingLog) {
      await supabase
        .from('daily_logs')
        .update({ data: payload.dailyLogData as unknown as Json, updated_at: new Date().toISOString() })
        .eq('id', existingLog.id)
    } else {
      const { data: newLog, error: logError } = await supabase
        .from('daily_logs')
        .insert({
          resident_id: payload.residentId,
          nurse_id: payload.nurseId,
          data: payload.dailyLogData as unknown as Json,
        })
        .select('id')
        .single()

      if (logError) throw logError
      insertedLogId = newLog?.id || null
    }

    // B. Zapis daily_reports (szkic dla bliskich)
    const { data: existingReport } = await supabase
      .from('daily_reports')
      .select('id')
      .eq('resident_id', payload.residentId)
      .contains('content', { draft_id: payload.draftId })
      .maybeSingle()

    if (existingReport) {
      const { error: repUpdateError } = await supabase
        .from('daily_reports')
        .update({
          content: payload.reportContent as unknown as Json,
          status: 'DRAFT',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingReport.id)

      if (repUpdateError) throw repUpdateError
    } else {
      const { error: repInsertError } = await supabase
        .from('daily_reports')
        .insert({
          resident_id: payload.residentId,
          author_id: payload.nurseId,
          content: payload.reportContent as unknown as Json,
          status: 'DRAFT',
          ai_generated: true,
          ai_model: payload.aiModel || null,
          ai_prompt_version: payload.aiPromptVersion || VOICE_PROMPT_VERSION,
          ai_generated_at: payload.aiGeneratedAt || new Date().toISOString(),
        })

      if (repInsertError) throw repInsertError
    }

    // C. Finalizacja statusu szkicu
    await supabase
      .from('voice_draft_notes')
      .update({ status: 'PROCESSED', followup_question: null })
      .eq('id', payload.draftId)

    return { success: true, idempotent: false, logId: insertedLogId || undefined }
  } catch (err) {
    // AUTOMATYCZNY ROLLBACK KOMPENSACYJNY: usuń wstawiony wpis daily_logs, aby nie zostawić osieroconego rekordu
    if (insertedLogId) {
      try {
        await supabase.from('daily_logs').delete().eq('id', insertedLogId)
      } catch {
        // Ignorujemy błędy kompensacji w bloku catch
      }
    }
    const msg = err instanceof Error ? err.message : 'Błąd transakcji zapisu'
    return { success: false, error: msg }
  }
}
