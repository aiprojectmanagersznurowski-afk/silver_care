import { createClient } from '@/lib/supabase/server'
import { StaffBoardClient } from '@/components/StaffBoardClient'

export const dynamic = 'force-dynamic'

export default async function StaffDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: residents, error } = await supabase
    .from('residents')
    .select(`
      id,
      first_name,
      last_name,
      archived_at,
      bed_assignments (
        unassigned_at,
        beds (
          label,
          rooms (
            number,
            floor_id,
            floors (
              label
            )
          )
        )
      ),
      voice_draft_notes (
        id,
        status
      ),
      daily_reports (
        id,
        status
      )
    `)
    .is('archived_at', null)
    .order('last_name', { ascending: true })

  // Extract unique floors for filter
  const floorSet = new Set<string>()
  for (const r of residents || []) {
    const active = r.bed_assignments?.find((a: any) => a.unassigned_at === null)
    const floorLabel = (active as any)?.beds?.rooms?.floors?.label
    if (floorLabel) floorSet.add(floorLabel)
  }

  return (
    <>
      <div className="bg-yellow-50 text-yellow-800 text-xs p-2 mb-4 border border-yellow-200">
        Debug Info: Zalogowany jako: {user?.email || 'BRAK SESJI SERWERA!'} | 
        OrgID (app): {user?.app_metadata?.organization_id || 'brak'} |
        Błędy zapytania: {error ? JSON.stringify(error) : 'brak'} | 
        Znalezieni pensjonariusze: {residents?.length || 0}
      </div>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <strong className="font-bold">Error loading residents: </strong>
          <span className="block sm:inline">{error.message} (Code: {error.code})</span>
        </div>
      )}
      <StaffBoardClient
        residents={(residents || []) as Record<string, unknown>[]}
        floors={Array.from(floorSet).sort()}
      />
    </>
  )
}
