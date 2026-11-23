import { SHIFT_POLICY, SHIFT_TASK_POLICY } from '@silvercare/contracts/src/generated/facility'
import type { TaskStatus } from '@/lib/shifts/shift-tasks-view'

export type HandoverCompleteness = (typeof SHIFT_TASK_POLICY.closure.completeness)[number]

export interface HandoverReceipt {
  id: string
  source: string
  receivedAt: string
}

export interface HandoverFact extends HandoverReceipt {
  sourceId: string
  recordedAt: string
  attribution: string
  text: string | null
}

export interface HandoverTaskState {
  id: string
  status: TaskStatus
  assigneeId: string | null
  carriedToTaskId: string | null
}

export interface HandoverVersion {
  version: number
  previousVersion: number | null
  completeness: HandoverCompleteness
  reason: string | null
  approvedAt: string
  approvedBy: string
  facts: HandoverFact[]
  tasks: HandoverTaskState[]
  expectedSourceIds: string[]
}

export interface HandoverDraft {
  revision: string
  latestVersion: number | null
  canApprove: boolean
  nextShift: { id: string | null; code: string | null; name: string | null; date: string }
  exceptions: number
  unknownAuthors: number
  facts: HandoverFact[]
  receipts: HandoverReceipt[]
  tasks: HandoverTaskState[]
  versions: HandoverVersion[]
}

export interface ShiftHandoverAuditEvent {
  id: string
  action: string
  at: string
  actor?: string
  taskId?: string
  sourceTaskId?: string
  version?: number
  previousVersion?: number
  from?: TaskStatus
  to?: TaskStatus
  assigneeId?: string
  previousAssigneeId?: string
}

export const completenessLabels: Record<HandoverCompleteness, string> = {
  COMPLETE: 'Kompletny',
  PARTIAL: 'Częściowy',
  UNKNOWN: 'Nieustalony',
}

export function handoverSourceLabel(source: string) {
  return source === 'DEVICE' ? 'Dyktafon' : 'Web'
}

export function handoverAuthorLabel(attribution: string) {
  switch (attribution) {
    case 'AUTHENTICATED_SESSION': return 'Autor z sesji webowej'
    case 'DECLARED_SESSION': return 'Autor zadeklarowany'
    case 'MANUAL_SEGMENT_CORRECTION': return 'Autor ustalony przez kierownika'
    default: return 'Autor nierozpoznany'
  }
}

const dateTime = new Intl.DateTimeFormat('pl-PL', {
  timeZone: SHIFT_POLICY.timezone,
  dateStyle: 'short',
  timeStyle: 'short',
})

export function formatHandoverTime(iso: string) {
  return dateTime.format(new Date(iso))
}
