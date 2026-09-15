'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface BulkPublishResult {
  success: boolean
  publishedCount?: number
  error?: string
}

export async function bulkPublishReportsAction(reportIds: string[]): Promise<BulkPublishResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Brak aktywnej sesji użytkownika.' }
  }

  const role = user.app_metadata?.role as string | undefined
  const orgId = user.app_metadata?.organization_id as string | undefined

  const allowedRoles = ['nurse', 'caregiver', 'paramedic', 'org_admin', 'super_admin']
  if (!role || !allowedRoles.includes(role)) {
    return { success: false, error: 'Brak uprawnień do publikacji raportów.' }
  }

  if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
    return { success: false, error: 'Brak wybranych raportów do publikacji.' }
  }

  // Wymóg AC1: jednoczesne zatwierdzenie do 10 raportów dziennych jednym kliknięciem
  if (reportIds.length > 10) {
    return {
      success: false,
      error: 'Jednorazowo można opublikować maksymalnie 10 raportów.',
    }
  }

  const adminClient = createAdminClient()

  // Pobierz raporty aby zweryfikować stan DRAFT oraz przynależność do placówki
  const { data: reports, error: fetchErr } = await adminClient
    .from('daily_reports')
    .select('id, resident_id, status, organization_id')
    .in('id', reportIds)

  if (fetchErr || !reports) {
    return { success: false, error: 'Błąd podczas pobierania wybranych raportów.' }
  }

  const validDraftIds = reports
    .filter((r) => r.status === 'DRAFT' && (!orgId || role === 'super_admin' || r.organization_id === orgId))
    .map((r) => r.id)

  if (validDraftIds.length === 0) {
    return { success: false, error: 'Żaden z wybranych raportów nie kwalifikuje się do publikacji (muszą być szkicami).' }
  }

  const { error: updateErr } = await adminClient
    .from('daily_reports')
    .update({
      status: 'PUBLISHED',
      published_at: new Date().toISOString(),
    })
    .in('id', validDraftIds)

  if (updateErr) {
    return { success: false, error: `Błąd podczas publikacji raportów: ${updateErr.message}` }
  }

  // Zapis do audit_logs
  await adminClient.from('audit_logs').insert({
    organization_id: orgId || null,
    user_id: user.id,
    action: 'REPORTS_BULK_PUBLISHED',
    target_table: 'daily_reports',
    target_id: validDraftIds[0],
    details: {
      published_count: validDraftIds.length,
      report_ids: validDraftIds,
    },
  })

  revalidatePath('/staff/reports')
  return { success: true, publishedCount: validDraftIds.length }
}

export async function quickLogRoutineObservationAction(
  residentId: string,
  summary: string = 'Stan stabilny, podopieczny spokojny, bez uwag.'
): Promise<{ success: boolean; error?: string; logId?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Brak aktywnej sesji użytkownika.' }
  }

  const role = user.app_metadata?.role as string | undefined
  const orgId = user.app_metadata?.organization_id as string | undefined

  const allowedRoles = ['nurse', 'caregiver', 'paramedic', 'org_admin', 'super_admin']
  if (!role || !allowedRoles.includes(role)) {
    return { success: false, error: 'Brak uprawnień do rejestracji obserwacji.' }
  }

  const adminClient = createAdminClient()

  // Sprawdź czy podopieczny istnieje w placówce
  const { data: resident, error: resErr } = await adminClient
    .from('residents')
    .select('id, organization_id')
    .eq('id', residentId)
    .single()

  if (resErr || !resident) {
    return { success: false, error: 'Nie znaleziono podopiecznego.' }
  }

  const { data: newLog, error: insertErr } = await adminClient
    .from('daily_logs')
    .insert({
      organization_id: resident.organization_id,
      resident_id: residentId,
      author_id: user.id,
      activity_type: 'ROUTINE_OBSERVATION',
      notes: summary,
      metadata: { source: 'quick_rounds_1click' },
    })
    .select('id')
    .single()

  if (insertErr) {
    return { success: false, error: `Błąd zapisu wpisu: ${insertErr.message}` }
  }

  revalidatePath('/staff')
  return { success: true, logId: newLog?.id }
}
