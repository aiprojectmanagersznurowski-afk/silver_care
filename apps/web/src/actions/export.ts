'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  ExportFilterOptions,
  ResidentExportRecord,
  formatResidentsForExport,
  generateCsvWithBom,
  ExportRowFormatted,
} from '@/lib/export-helpers'

interface RawBedAssignment {
  id: string
  unassigned_at: string | null
  beds: {
    label: string
    rooms: {
      number: string
    } | null
  } | null
}

interface RawResidentWithBeds {
  id: string
  first_name: string
  last_name: string
  gender: string | null
  birth_date: string | null
  care_level: string | null
  is_zsn: boolean | null
  archived_at: string | null
  created_at: string
  bed_assignments: RawBedAssignment[] | null
}

export async function exportResidentsDataAction(options: ExportFilterOptions): Promise<{
  error?: string
  csvContent?: string
  rows?: ExportRowFormatted[]
  count?: number
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Brak autoryzacji sesji.' }
  const orgId = user.app_metadata?.organization_id
  if (!orgId) return { error: 'Brak przypisanej placówki.' }

  const role = user.app_metadata?.role
  if (role !== 'org_admin' && role !== 'super_admin' && role !== 'admin') {
    return { error: 'Tylko administrator placówki ma uprawnienia do eksportu danych.' }
  }

  const adminClient = createAdminClient()

  // Pobieramy pensjonariuszy z ich przypisaniami do łóżek i pokoi
  const { data: residents, error: fetchErr } = await adminClient
    .from('residents')
    .select(`
      id,
      first_name,
      last_name,
      gender,
      birth_date,
      care_level,
      is_zsn,
      archived_at,
      created_at,
      bed_assignments (
        id,
        unassigned_at,
        beds (
          label,
          rooms (
            number
          )
        )
      )
    `)
    .eq('organization_id', orgId)
    .order('last_name', { ascending: true })

  if (fetchErr || !residents) {
    return { error: 'Błąd pobierania danych placówki: ' + (fetchErr?.message || '') }
  }

  const rawList = residents as unknown as RawResidentWithBeds[]

  const records: ResidentExportRecord[] = rawList.map((r) => {
    const activeAssignments = (r.bed_assignments || []).filter((a) => a.unassigned_at === null)
    const currentBed = activeAssignments.length > 0 ? activeAssignments[0].beds : null

    return {
      id: r.id,
      first_name: r.first_name,
      last_name: r.last_name,
      gender: r.gender,
      birth_date: r.birth_date,
      care_level: r.care_level,
      is_zsn: r.is_zsn,
      room_number: currentBed?.rooms?.number || null,
      bed_label: currentBed?.label || null,
      archived_at: r.archived_at,
      created_at: r.created_at,
    }
  })

  const formattedRows = formatResidentsForExport(records, options)
  const csvContent = generateCsvWithBom(formattedRows)

  // Rejestracja w audit_logs
  await adminClient.from('audit_logs').insert({
    organization_id: orgId,
    user_id: user.id,
    action: 'RESIDENTS_DATA_EXPORT',
    target_table: 'residents',
    target_id: orgId,
    details: {
      exported_count: formattedRows.length,
      filters: options,
    },
  })

  return {
    csvContent,
    rows: formattedRows,
    count: formattedRows.length,
  }
}
