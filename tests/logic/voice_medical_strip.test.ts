import { describe, it, expect, vi } from 'vitest'
import { redactVoiceTranscript } from '../../apps/web/src/lib/voice-redactor'
import { validateNoMedicalDataInReport } from '../../packages/contracts/src/validation'
import { MEDICAL_CATEGORIES } from '../../packages/contracts/src/generated/voice'
import { VOICE_PROCESSING_PROMPT } from '../../packages/contracts/src/prompts'
import { saveProcessedVoiceDraft } from '../../apps/web/src/lib/voice-process-persistence'

describe('VOICE-MEDICAL-STRIP Logic', () => {

  it('deterministycznie ekstrahuje i wycina parametry kliniczne (ciśnienie, dawki, saturacja, temperatura) przed LLM @REQ: VOICE-MEDICAL-STRIP', () => {
    const rawTranscript = 'Senior zjadł ze smakiem śniadanie. Ciśnienie tętnicze 140/90 mmHg, saturacja 92% SpO2, temperatura 38.5°C. Podano 500 mg Paracetamolu o 10:00. Po południu spacerował po ogrodzie.'

    const result = redactVoiceTranscript(rawTranscript)

    expect(result.hasMedicalData).toBe(true)
    expect(result.extractedMedical.length).toBeGreaterThanOrEqual(4)

    // Oczyszczony transkrypt nie zawiera twardych parametrów ani nazw leków
    expect(result.cleanedTranscript).not.toContain('140/90')
    expect(result.cleanedTranscript).not.toContain('38.5')
    expect(result.cleanedTranscript).not.toContain('500 mg')
    expect(result.cleanedTranscript).not.toContain('Paracetamol')

    // Zachowane zdarzenia behawioralne
    expect(result.cleanedTranscript).toContain('Senior zjadł ze smakiem śniadanie')
    expect(result.cleanedTranscript).toContain('Po południu spacerował po ogrodzie')

    // Weryfikacja braku danych medycznych w zredagowanym tekście
    const check = validateNoMedicalDataInReport(result.cleanedTranscript)
    expect(check.hasMedical).toBe(false)
  })

  it('wycina całe frazy pomiarowe z liczbami i jednostkami bez zostawiania samotnych wartości ("saturacja 91%", "cukier 280", "Euthyrox 50 mikrogramów") @REQ: VOICE-MEDICAL-STRIP', () => {
    // 1. "saturacja 91%" — nie może zostać samotne "91%"
    const satTranscript = 'Podopieczny wyszedł na korytarz. Saturacja 91% po krótkim spacerze. Następnie usiadł w fotelu.'
    const satResult = redactVoiceTranscript(satTranscript)
    expect(satResult.cleanedTranscript).not.toContain('saturacja')
    expect(satResult.cleanedTranscript).not.toContain('Saturacja')
    expect(satResult.cleanedTranscript).not.toContain('91%')
    expect(satResult.cleanedTranscript).not.toContain('91')
    expect(satResult.cleanedTranscript).toContain('Podopieczny wyszedł na korytarz')
    expect(satResult.cleanedTranscript).toContain('Następnie usiadł w fotelu')
    expect(validateNoMedicalDataInReport(satResult.cleanedTranscript).hasMedical).toBe(false)

    // 2. "cukier 280" — nie może zostać samotne "280"
    const sugarTranscript = 'Senior wypił herbatę z cytryną. Cukier 280 przed obiadem. Zjadł zupę jarzynową.'
    const sugarResult = redactVoiceTranscript(sugarTranscript)
    expect(sugarResult.cleanedTranscript).not.toContain('cukier')
    expect(sugarResult.cleanedTranscript).not.toContain('Cukier')
    expect(sugarResult.cleanedTranscript).not.toContain('280')
    expect(sugarResult.cleanedTranscript).toContain('Senior wypił herbatę z cytryną')
    expect(sugarResult.cleanedTranscript).toContain('Zjadł zupę jarzynową')
    expect(validateNoMedicalDataInReport(sugarResult.cleanedTranscript).hasMedical).toBe(false)

    // 3. "Euthyrox 50 mikrogramów" — wycięcie leku razem z dawką
    const euthyroxTranscript = 'Podano Euthyrox 50 mikrogramów rano. Podopieczny uczestniczył w zajęciach plastycznych.'
    const euthyroxResult = redactVoiceTranscript(euthyroxTranscript)
    expect(euthyroxResult.cleanedTranscript).not.toContain('Euthyrox')
    expect(euthyroxResult.cleanedTranscript).not.toContain('50 mikrogramów')
    expect(euthyroxResult.cleanedTranscript).not.toContain('50')
    expect(euthyroxResult.cleanedTranscript).toContain('uczestniczył w zajęciach plastycznych')
    expect(validateNoMedicalDataInReport(euthyroxResult.cleanedTranscript).hasMedical).toBe(false)
  })

  it('poprawnie wycina polską fleksję chorób i leków ("insulinę", "cukrzycę", "nadciśnienie", "po zawale", "Metformax", "demencję") @REQ: VOICE-MEDICAL-STRIP', () => {
    const auditSamples = [
      { text: 'Pielęgniarka podała insulinę o 8:00. Senior zjadł owsiankę.', forbidden: ['insulinę', 'insulin'] },
      { text: 'Podopieczny choruje na cukrzycę od wielu lat. Spędził dzień w świetlicy.', forbidden: ['cukrzycę', 'cukrzyc'] },
      { text: 'Odnotowano nadciśnienie tętnicze w karcie. Senior czytał książkę.', forbidden: ['nadciśnienie'] },
      { text: 'Podopieczny jest po zawale i odpoczywa w pokoju.', forbidden: ['zawale', 'zawał'] },
      { text: 'Zaaplikowano Metformax po posiłku. Senior grał w szachy.', forbidden: ['Metformax', 'metformax'] },
      { text: 'Zdiagnozowano zaawansowaną demencję u podopiecznego. Wieczorem rozmawiał z córką.', forbidden: ['demencję', 'demencj'] },
    ]

    for (const sample of auditSamples) {
      const result = redactVoiceTranscript(sample.text)
      for (const f of sample.forbidden) {
        expect(result.cleanedTranscript.toLowerCase()).not.toContain(f.toLowerCase())
      }
      expect(validateNoMedicalDataInReport(result.cleanedTranscript).hasMedical).toBe(false)
    }
  })

  it('gwarantuje, że medication_event trafia wyłącznie do daily_logs, a nigdy do daily_reports.content, oraz działa w trybie fail-closed przy błędzie RPC @REQ: VOICE-MEDICAL-STRIP', async () => {
    let capturedRpcArgs: Record<string, unknown> | null = null
    const mockFrom = vi.fn()

    const mockSupabaseOk = {
      rpc: vi.fn(async (_fn: string, args: Record<string, unknown>) => {
        capturedRpcArgs = args
        return { data: { success: true, idempotent: false, log_id: 'log-1', report_id: 'rep-1' }, error: null }
      }),
      from: mockFrom,
    }

    const payloadWithMedLeakAttempt = {
      draftId: '550e8400-e29b-41d4-a716-446655440001',
      residentId: '550e8400-e29b-41d4-a716-446655440002',
      nurseId: '550e8400-e29b-41d4-a716-446655440003',
      dailyLogData: { medical: 'Metformax 500mg', medication_event: 'refused', medication_alert_requires_confirmation: true },
      reportContent: {
        text: 'Senior zjadł śniadanie.',
        draft_id: '550e8400-e29b-41d4-a716-446655440001',
        requires_staff_review: false,
        medication_event: 'refused',
        medication_alert_requires_confirmation: true,
      } as unknown as { text: string; draft_id: string; requires_staff_review: boolean },
    }

    // @ts-expect-error Mocked Supabase client
    const okResult = await saveProcessedVoiceDraft(mockSupabaseOk, payloadWithMedLeakAttempt)
    expect(okResult.success).toBe(true)
    expect(capturedRpcArgs).not.toBeNull()

    const savedReportContent = capturedRpcArgs!['p_report_content'] as Record<string, unknown>
    const savedLogData = capturedRpcArgs!['p_daily_log_data'] as Record<string, unknown>

    // W daily_reports.content NIE MA prawa znaleźć się medication_event ani szablon lekowy
    expect(savedReportContent).not.toHaveProperty('medication_event')
    expect(savedReportContent).not.toHaveProperty('medication_alert_requires_confirmation')
    expect(String(savedReportContent.text)).not.toContain('wsparcie')

    // W daily_logs.data medication_event jest zachowane dla personelu
    expect(savedLogData.medication_event).toBe('refused')
    expect(savedLogData.medication_alert_requires_confirmation).toBe(true)

    // Test Fail-Closed: błąd RPC rzuca wyjątek i NIE przechodzi po cichu na nieatomowy zapis (from() nie jest wołane)
    const mockSupabaseRpcErr = {
      rpc: vi.fn(async () => ({
        data: null,
        error: { code: '42501', message: 'Forbidden role for voice processing' },
      })),
      from: mockFrom,
    }

    await expect(
      // @ts-expect-error Mocked Supabase client
      saveProcessedVoiceDraft(mockSupabaseRpcErr, payloadWithMedLeakAttempt)
    ).rejects.toThrow(/42501/)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('wykonuje kompensacyjny rollback daily_logs przy błędzie zapisu daily_reports (gdy mock bez rpc) @REQ: VOICE-MEDICAL-STRIP', async () => {
    let deletedLogId: string | null = null

    // Mock supabase klienta bez funkcji rpc (typeof supabase.rpc !== 'function') symulujący błąd zapisu daily_reports
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'voice_draft_notes') {
          return {
            select: () => ({ eq: () => ({ single: async () => ({ data: { status: 'DRAFT' } }) }) }),
            update: () => ({ eq: async () => ({ error: null }) }),
          }
        }
        if (table === 'daily_logs') {
          return {
            select: () => ({
              eq: () => ({ contains: () => ({ maybeSingle: async () => ({ data: null }) }) }),
            }),
            insert: () => ({
              select: () => ({ single: async () => ({ data: { id: 'mock-log-123' }, error: null }) }),
            }),
            delete: () => ({
              eq: (_col: string, val: string) => {
                deletedLogId = val
                return Promise.resolve({ error: null })
              },
            }),
          }
        }
        if (table === 'daily_reports') {
          return {
            select: () => ({
              eq: () => ({ contains: () => ({ maybeSingle: async () => ({ data: null }) }) }),
            }),
            insert: () => {
              // Symulujemy awarię bazy danych podczas zapisu raportu
              return Promise.resolve({ error: new Error('Błąd zapisu raportu (Database Connection Lost)') })
            },
          }
        }
        return {}
      }),
    }

    const payload = {
      draftId: '550e8400-e29b-41d4-a716-446655440001',
      residentId: '550e8400-e29b-41d4-a716-446655440002',
      nurseId: '550e8400-e29b-41d4-a716-446655440003',
      dailyLogData: { medical: 'Test log' },
      reportContent: { text: 'Raport testowy', draft_id: '550e8400-e29b-41d4-a716-446655440001', requires_staff_review: false },
    }

    // @ts-expect-error Mocked Supabase client
    const result = await saveProcessedVoiceDraft(mockSupabase, payload)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Błąd zapisu raportu')
    // Potwierdzenie automatycznego rollbacku kompensacyjnego na daily_logs
    expect(deletedLogId).toBe('mock-log-123')
  })

  it('maskuje numery PESEL, telefony oraz adresy e-mail przed przekazaniem do LLM @REQ: VOICE-MEDICAL-STRIP', () => {
    const rawTranscript = 'Kontakt z córką pod 600-100-200 lub anna@example.com. PESEL 85010112345. Pensjonariusz odpoczywał w pokoju.'

    const result = redactVoiceTranscript(rawTranscript)

    expect(result.hasPii).toBe(true)
    expect(result.cleanedTranscript).toContain('[PESEL ZAMASKOWANY]')
    expect(result.cleanedTranscript).toContain('[TELEFON ZAMASKOWANY]')
    expect(result.cleanedTranscript).toContain('[EMAIL ZAMASKOWANY]')

    expect(result.cleanedTranscript).not.toContain('85010112345')
    expect(result.cleanedTranscript).not.toContain('600-100-200')
    expect(result.cleanedTranscript).not.toContain('anna@example.com')
  })

  it('classifier prompt covers all categories from MEDICAL_CATEGORIES @REQ: VOICE-MEDICAL-STRIP', () => {
    for (const cat of MEDICAL_CATEGORIES) {
      expect(VOICE_PROCESSING_PROMPT.toLowerCase()).toContain(cat.id.toLowerCase())
    }
  })

  it('REDACT stage rejects texts containing medication names and clinical data @REQ: VOICE-MEDICAL-STRIP', () => {
    const medicalSamples = [
      'Podano 2 tabletki Furaginy o 14:00.',
      'Ciśnienie tętnicze 150/90, saturacja 92%.',
      'Wyniki badań krwi wskazują na podwyższony mocznik.',
      'Zalecenie lekarskie: konsultacja kardiologiczna.'
    ]

    for (const sample of medicalSamples) {
      const check = validateNoMedicalDataInReport(sample)
      expect(check.hasMedical).toBe(true)
    }

    const behavioralClean = 'Senior zjadł ze smakiem podwieczorek i wyszedł do ogrodu na krótki spacer.'
    const cleanCheck = validateNoMedicalDataInReport(behavioralClean)
    expect(cleanCheck.hasMedical).toBe(false)
  })

})
