'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { isImpersonationSessionActive, assertMutationAllowedDuringImpersonation } from '@/lib/impersonation-guards'
import { RawResidentRow, validateResidentRows, ValidatedResidentRow, DryRunResult } from '@/lib/bulk-import-helpers'
import { encryptNationalId } from '@/lib/identity_crypto'
import crypto from 'crypto'

function hashNationalId(value: string, salt: string = 'silvercare_pesel_salt'): string {
  return crypto.createHmac('sha256', salt).update(value).digest('hex')
}

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

  // Pobierz wszystkie istniejące pesel_hash z tej placówki
  const { data: existing, error: existingErr } = await adminClient
    .from('residents')
    .select('pesel_hash')
    .eq('organization_id', orgId)

  if (existingErr) {
    return { error: 'Błąd sprawdzania bazy danych: ' + existingErr.message }
  }

  const existingHashes = new Set<string>((existing || []).map((r) => r.pesel_hash).filter(Boolean))

  const dryRun = validateResidentRows(rows, existingHashes)
  return { result: dryRun }
}

export async function commitBulkImportAction(rowsToImport: ValidatedResidentRow[]): Promise<{
  error?: string
  importedCount?: number
}> {
  const cookieStore = await cookies()
  const guard = assertMutationAllowedDuringImpersonation(isImpersonationSessionActive(cookieStore))
  if (!guard.allowed) {
    return { error: guard.error }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Brak autoryzacji sesji.' }
  const orgId = user.app_metadata?.organization_id
  if (!orgId) return { error: 'Brak przypisanej placówki.' }

  const role = user.app_metadata?.role
  if (role !== 'org_admin' && role !== 'super_admin' && role !== 'admin') {
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
    pesel_encrypted: encryptNationalId(r.nationalId),
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

  // Wpis do audit_logs
  await adminClient.from('audit_logs').insert({
    organization_id: orgId,
    resident_id: null,
    action: 'RESIDENTS_BULK_IMPORT',
    performed_by: user.id,
    payload: {
      imported_count: totalImported,
      source: 'excel_csv_import',
    },
  })

  revalidatePath('/admin/residents')
  return { importedCount: totalImported }
}
