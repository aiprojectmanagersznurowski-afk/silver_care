'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { isImpersonationSessionActive, assertMutationAllowedDuringImpersonation } from '@/lib/impersonation-guards'
import {
  RawResidentRow,
  validateResidentRows,
  ValidatedResidentRow,
  DryRunResult,
  evaluateCapacityExceeded,
} from '@/lib/bulk-import-helpers'
import { hashNationalId } from '@/lib/national-id-hash'

export async function analyzeBulkImportAction(rows: RawResidentRow[]): Promise<{
  error?: string
  result?: DryRunResult
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Brak autoryzacji sesji.' }
  const orgId = user.app_metadata?.organization_id
  if (!orgId) return { error: 'Brak przypisanej placówki.' }

  const adminClient = createAdminClient()

  // Pobierz wszystkie istniejące pesel_hash z tej placówki oraz status archiwizacji
  const { data: existing, error: existingErr } = await adminClient
    .from('residents')
    .select('pesel_hash, archived_at')
    .eq('organization_id', orgId)

  if (existingErr) {
    return { error: 'Błąd sprawdzania bazy danych: ' + existingErr.message }
  }

  // Pobierz zadeklarowaną pojemność placówki
  const { data: orgData } = await adminClient
    .from('organizations')
    .select('resident_limit')
    .eq('id', orgId)
    .single()

  const residentLimit = Number(orgData?.resident_limit || 50)
  const currentActiveCount = (existing || []).filter((r) => !r.archived_at).length
  const existingHashes = new Set<string>(
    (existing || []).map((r) => r.pesel_hash).filter((h): h is string => Boolean(h))
  )

  const dryRun = validateResidentRows(rows, existingHashes)
  const capacityInfo = evaluateCapacityExceeded(dryRun.validRowsCount, currentActiveCount, residentLimit)

  return {
    result: {
      ...dryRun,
      ...capacityInfo,
    },
  }
}

export async function commitBulkImportAction(rowsToImport: ValidatedResidentRow[]): Promise<{
  error?: string
  importedCount?: number
  capacityExceeded?: { residentLimit: number; activeResidents: number }
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Brak autoryzacji sesji.' }

  const cookieStore = await cookies()
  const guard = assertMutationAllowedDuringImpersonation(isImpersonationSessionActive(cookieStore, user))
  if (!guard.allowed) {
    return { error: guard.error }
  }
  const orgId = user.app_metadata?.organization_id
  if (!orgId) return { error: 'Brak przypisanej placówki.' }

  const role = user.app_metadata?.role
  if (role !== 'org_admin' && role !== 'super_admin') {
    return { error: 'Tylko administrator placówki może wykonywać masowy import.' }
  }

  const validRows = rowsToImport.filter((r) => r.isValid)
  if (validRows.length === 0) {
    return { error: 'Brak poprawnych wierszy do zaimportowania.' }
  }

  const adminClient = createAdminClient()

  // Przygotowanie rekordów do wstawienia
  const records = validRows.map((r) => ({
    organization_id: orgId,
    first_name: r.firstName,
    last_name: r.lastName,
    pesel_hash: hashNationalId(r.nationalId),
    gender: r.gender,
    birth_date: r.birthDate,
    care_level: r.careLevel,
    is_zsn: r.isZsn,
    notes: r.notes,
    admission_date: r.admissionDate || new Date().toISOString().substring(0, 10),
  }))

  // Wstawianie w batchach po 50 rekordów
  const batchSize = 50
  let totalImported = 0

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const { data: inserted, error: insertErr } = await adminClient
      .from('residents')
      .insert(batch)
      .select('id')

    if (insertErr) {
      return { error: `Błąd podczas zapisu partii rekordów: ${insertErr.message}` }
    }
    totalImported += (inserted || []).length
  }

  // Limit miejsc zmienia wyłącznie super admin (CAPACITY_POLICY, ADM-CAPACITY-LIMIT) — import go nie podnosi,
  // tylko odnotowuje przekroczenie w audycie
  const { count: totalActiveCount } = await adminClient
    .from('residents')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .is('archived_at', null)

  const activeTotal = totalActiveCount || totalImported

  const { data: orgRecord } = await adminClient
    .from('organizations')
    .select('resident_limit')
    .eq('id', orgId)
    .single()

  const currentLimit = Number(orgRecord?.resident_limit || 50)
  const capacityExceeded = activeTotal > currentLimit
    ? { residentLimit: currentLimit, activeResidents: activeTotal }
    : undefined

  if (capacityExceeded) {
    await adminClient.from('audit_logs').insert({
      organization_id: orgId,
      resident_id: null,
      action: 'ORGANIZATION_CAPACITY_EXCEEDED',
      performed_by: user.id,
      payload: {
        operation: 'resident_bulk_import',
        resident_limit: currentLimit,
        active_resident_count: activeTotal,
      },
    })
  }

  // Wpis do audit_logs dla masowego importu
  await adminClient.from('audit_logs').insert({
    organization_id: orgId,
    resident_id: null,
    action: 'RESIDENTS_BULK_IMPORT',
    performed_by: user.id,
    payload: {
      imported_count: totalImported,
      source: 'excel_csv_import',
      capacity_exceeded: Boolean(capacityExceeded),
    },
  })

  revalidatePath('/admin/residents')
  revalidatePath('/admin/organizations')
  revalidatePath(`/admin/organizations/${orgId}`)

  return {
    importedCount: totalImported,
    capacityExceeded,
  }
}
