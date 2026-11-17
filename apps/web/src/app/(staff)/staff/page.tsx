import { createClient } from '@/lib/supabase/server'
import { StaffBoardClient } from '@/components/StaffBoardClient'
import { residentPhotoUrls } from '@/lib/resident-photo'

export const dynamic = 'force-dynamic'

export default async function StaffDashboard() {
  const supabase = await createClient()

  const residentsRes = await supabase
    .from('residents')
    .select(`
      id,
      first_name,
      last_name,
      avatar_url,
      photo_path,
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
        status,
        created_at
      ),
      daily_reports (
        id,
        status
      )
    `)
    .is('archived_at', null)
    .order('last_name', { ascending: true })

  // SC-ADM-25: zdjęcia z prywatnego bucketu przez podpisane linki; bez photo_path zostaje dotychczasowe zdjęcie
  const rows = residentsRes.data || []
  const photoUrls = await residentPhotoUrls(supabase, rows.map((r) => r.photo_path))
  const residents = rows.map((r) => (r.photo_path ? { ...r, avatar_url: photoUrls[r.photo_path] ?? null } : r))

  // Extract unique floors for filter
  const floorSet = new Set<string>()
  for (const r of residents) {
    const active = (r.bed_assignments as Record<string, unknown>[])?.find((a) => a.unassigned_at === null)
    const beds = active?.beds as Record<string, unknown> | undefined
    const rooms = beds?.rooms as Record<string, unknown> | undefined
    const floorLabel = rooms?.floor as string | undefined
    if (floorLabel) floorSet.add(floorLabel)
  }

  return (
    <StaffBoardClient
      residents={residents as Record<string, unknown>[]}
      floors={Array.from(floorSet).sort()}
    />
  )
}

