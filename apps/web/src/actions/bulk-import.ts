'use server'

import { featureDisabledMessage, isOrgFeatureEnabled } from '@/lib/feature-flags'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { staffMfaSatisfied } from '@/lib/auth/staff-mfa'
import type { User } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { isImpersonationSessionActive, assertMutationAllowedDuringImpersonation, safeGetCookieStore } from '@/lib/impersonation-guards'
import {
  RawResidentRow,
  validateResidentRows,
  ValidatedResidentRow,
  DryRunResult,
  evaluateCapacityExceeded,
} from '@/lib/bulk-import-helpers'
import { hashNationalId } from '@/lib/national-id-hash'
import { countPresentResidents, RESIDENT_PRESENCE_COLUMNS, ResidentPresenceFields } from '@/lib/capacity-limit'

async function canManageBulkImport(supabase: Awaited<ReturnType<typeof createClient>>, user: User) {
  if (user.app_metadata?.role !== 'org_admin') return false
  const { data } = await supabase.auth.getClaims()
  return data?.claims.sub === user.id && await staffMfaSatisfied(supabase, data.claims.aal)
}

export async function analyzeBulkImportAction(rows: RawResidentRow[]): Promise<{
  error?: string
  result?: DryRunResult
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Brak autoryzacji sesji.' }
  if (!await canManageBulkImport(supabase, user)) {
    return { error: 'Import wymaga konta kierownika placówki i potwierdzenia MFA.' }
  }
  const orgId = user.app_metadata?.organization_id
  if (!orgId) return { error: 'Brak przypisanej placówki.' }

  if (!(await isOrgFeatureEnabled(supabase, orgId, 'module_residents_management'))) {
    return { error: featureDisabledMessage }
  }

  const adminClient = createAdminClient()

  // Pobierz wszystkie istniejące pesel_hash z tej placówki oraz status archiwizacji
  const { data: existing, error: existingErr } = await adminClient
    .from('residents')
    .select(`pesel_hash, ${RESIDENT_PRESENCE_COLUMNS}`)
    .eq('organization_id', orgId)

  if (existingErr) {
    return { error: 'Błąd sprawdzania bazy danych: ' + existingErr.message }
  }

  // Pobierz limit miejsc placówki
  const { data: orgData } = await adminClient
    .from('organizations')
    .select('resident_limit')
    .eq('id', orgId)
    .single()

  const residentLimit = Number(orgData?.resident_limit ?? 50)
  // Miejsce zajmują tylko podopieczni przebywający w placówce (ADM-CAPACITY-LIMIT, decyzja Michała 2026-10-29)
  const currentActiveCount = countPresentResidents((existing || []) as unknown as ResidentPresenceFields[])
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

export async function commitBulkImportAction(rowsToImport: ValidatedResidentRow[], confirmCapacity = false): Promise<{
  error?: string
  importedCount?: number
  capacityExceeded?: { residentLimit: number; activeResidents: number }
  capacityConfirmationRequired?: boolean
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Brak autoryzacji sesji.' }
  if (!await canManageBulkImport(supabase, user)) {
    return { error: 'Import wymaga konta kierownika placówki i potwierdzenia MFA.' }
  }

  const cookieStore = await safeGetCookieStore()
  const guard = assertMutationAllowedDuringImpersonation(isImpersonationSessionActive(cookieStore, user))
  if (!guard.allowed) {
    return { error: guard.error }
  }
  const orgId = user.app_metadata?.organization_id
  if (!orgId) return { error: 'Brak przypisanej placówki.' }

  const selectedRows = rowsToImport.filter((r) => r.isValid)
  const { rows, validRowsCount } = validateResidentRows(selectedRows)
  if (validRowsCount === 0 || validRowsCount !== selectedRows.length) {
    return { error: 'Wiersze importu są niepoprawne lub powtórzone. Sprawdź podgląd ponownie.' }
  }

  if (!(await isOrgFeatureEnabled(supabase, orgId, 'module_residents_management'))) {
    return { error: featureDisabledMessage }
  }

  const records = rows.map((r) => ({
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

  const { data, error } = await supabase.rpc('commit_resident_import', {
    p_rows: records, p_confirm_capacity: confirmCapacity,
  })
  if (error?.message === 'RESIDENT_IMPORT_CAPACITY_CONFIRMATION') {
    return { error: 'Import wymaga potwierdzenia aktualnego limitu miejsc. Odśwież podgląd.', capacityConfirmationRequired: true }
  }
  if (error?.code === '23505') {
    return { error: 'Co najmniej jeden podopieczny już istnieje. Uruchom podgląd ponownie.' }
  }
  if (error || !data || typeof data !== 'object' || Array.isArray(data)
    || typeof data.importedCount !== 'number' || typeof data.residentLimit !== 'number'
    || typeof data.activeResidents !== 'number') {
    return { error: 'Nie udało się potwierdzić zapisu importu. Uruchom podgląd przed ponowieniem.' }
  }

  revalidatePath('/admin/residents')
  revalidatePath('/admin/organizations')
  revalidatePath(`/admin/organizations/${orgId}`)

  return {
    importedCount: data.importedCount,
    capacityExceeded: data.activeResidents > data.residentLimit
      ? { residentLimit: data.residentLimit, activeResidents: data.activeResidents }
      : undefined,
  }
}
