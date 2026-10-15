/**
 * staff-board-types.ts — Typy i funkcje pomocnicze dla tablicy personelu.
 */

export type NoteStatus = 'ready' | 'draft' | 'none'

export interface UnansweredInfo {
  hasUnanswered: boolean
  unansweredCount: number
  lastMessageAt?: string
  lastMessageSnippet?: string
}

export interface StaffBoardClientProps {
  residents: Record<string, unknown>[]
  floors: string[]
  unansweredMessagesMap?: Record<string, UnansweredInfo>
}

export function getNoteStatus(resident: Record<string, unknown>): NoteStatus {
  const reports = (resident.daily_reports || []) as Array<Record<string, string>>
  const drafts = (resident.voice_draft_notes || []) as Array<Record<string, string>>

  if (reports.some((r) => r.status === 'PUBLISHED')) return 'ready'
  if (drafts.some((d) => d.status === 'DRAFT') || reports.some((r) => r.status === 'DRAFT')) return 'draft'
  return 'none'
}

export function getActiveAssignment(resident: Record<string, unknown>) {
  const assignments = (resident.bed_assignments || []) as Array<Record<string, unknown>>
  return assignments.find((a) => a.unassigned_at === null) as Record<string, unknown> | undefined
}

export function getFloorLabel(resident: Record<string, unknown>): string | null {
  const active = getActiveAssignment(resident)
  if (!active) return null
  const beds = active.beds as Record<string, unknown> | undefined
  const rooms = beds?.rooms as Record<string, unknown> | undefined
  return (rooms?.floor as string) || null
}

export function getRoomNumber(resident: Record<string, unknown>): string | null {
  const active = getActiveAssignment(resident)
  if (!active) return null
  const beds = active.beds as Record<string, unknown> | undefined
  const rooms = beds?.rooms as Record<string, unknown> | undefined
  return (rooms?.number as string) || null
}

export const STATUS_CONFIG: Record<NoteStatus, { label: string; className: string }> = {
  ready: { label: 'Raport gotowy', className: 'bg-muted text-foreground ring-border' },
  draft: { label: 'Wersja robocza', className: 'bg-muted text-foreground ring-border' },
  none: { label: 'Brak wpisu', className: 'bg-muted text-foreground ring-border' },
}
