import { createClient } from '@/lib/supabase/server'
import { StaffBoardClient } from '@/components/StaffBoardClient'

export default async function StaffDashboard() {
  const supabase = await createClient()

  const { data: residents } = await supabase
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
    const active = r.bed_assignments?.find((a: Record<string, unknown>) => a.unassigned_at === null)
    const floorLabel = (active as Record<string, unknown>)?.beds?.rooms?.floors?.label
    if (floorLabel) floorSet.add(floorLabel)
  }

  return (
    <StaffBoardClient
      residents={(residents || []) as Record<string, unknown>[]}
      floors={Array.from(floorSet).sort()}
    />
  )
}
