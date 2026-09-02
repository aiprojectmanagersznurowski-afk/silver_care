import { createClient } from '@/lib/supabase/server'
import { StaffBoardClient } from '@/components/StaffBoardClient'

export const dynamic = 'force-dynamic'

export default async function StaffDashboard() {
  const supabase = await createClient()

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
            floor
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
    const active = (r.bed_assignments as Record<string, unknown>[])?.find((a) => a.unassigned_at === null)
    const beds = active?.beds as Record<string, unknown> | undefined
    const rooms = beds?.rooms as Record<string, unknown> | undefined
    const floorLabel = rooms?.floor as string | undefined
    if (floorLabel) floorSet.add(floorLabel)
  }

  return (
    <StaffBoardClient
      residents={(residents || []) as Record<string, unknown>[]}
      floors={Array.from(floorSet).sort()}
    />
  )
}
