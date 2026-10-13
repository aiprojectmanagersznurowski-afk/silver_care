import { createClient } from '@/lib/supabase/server'
import { StaffBoardClient } from '@/components/StaffBoardClient'
import {
  calculateUnansweredMessagesPerResident,
  type RawMessage,
} from '@/lib/messages-helper'

export const dynamic = 'force-dynamic'

export default async function StaffDashboard() {
  const supabase = await createClient()

  const [residentsRes, messagesRes] = await Promise.all([
    supabase
      .from('residents')
      .select(`
        id,
        first_name,
        last_name,
        avatar_url,
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
      .order('last_name', { ascending: true }),

    supabase
      .from('family_messages')
      .select('id, resident_id, relative_user_id, is_from_family, created_at, content')
      .order('created_at', { ascending: true }),
  ])

  const residents = residentsRes.data || []
  const messages = (messagesRes.data || []) as unknown as RawMessage[]

  // Wyliczamy mapę oczekujących wiadomości od rodzin
  const unansweredMap = calculateUnansweredMessagesPerResident(messages)
  const serializableUnansweredMap: Record<
    string,
    { hasUnanswered: boolean; unansweredCount: number; lastMessageAt: string; lastMessageSnippet?: string }
  > = {}

  for (const [resId, status] of unansweredMap.entries()) {
    serializableUnansweredMap[resId] = {
      hasUnanswered: status.hasUnanswered,
      unansweredCount: status.unansweredCount,
      lastMessageAt: status.lastMessageAt,
      lastMessageSnippet: status.lastMessageSnippet,
    }
  }

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
      unansweredMessagesMap={serializableUnansweredMap}
    />
  )
}

