import { sourceLabel, statusLabel, type TaskSource, type TaskStatus } from '@/lib/shifts/shift-tasks-view'

/**
 * Zadania podopiecznego na jego karcie (SC-ADM-21, ADM-RESIDENT-CARD-TASKS). Fakty: co, kiedy, skąd i dla kogo.
 * „Wymaga uwagi” wynika wyłącznie z otwartego zadania zaakceptowanego przez człowieka (TODO), nie z oceny stanu
 * zdrowia i nie z propozycji (PROPOSED).
 */

export const RECENT_DONE_DAYS = 7

/** Kolumny zadania pobierane na kartę: jawna lista, bez cytatu źródłowego i bez autora. */
export const RESIDENT_TASK_SELECT =
  'id, title, due_time, shift_date, source, status, carried_from_task_id, assignee_user_id, settled_at, shift_definitions!fk_shift_tasks_definition(name)'

export interface ResidentTaskRow {
  id: string
  title: string
  due_time: string | null
  shift_date: string
  source: string
  status: string
  carried_from_task_id: string | null
  assignee_user_id: string | null
  settled_at: string | null
  shift_definitions: { name: string } | null
}

export interface ResidentTaskItem {
  id: string
  title: string
  shiftDate: string
  shiftName: string | null
  dueTime: string | null
  status: TaskStatus
  statusLabel: string
  sourceLabel: string
  assigneeLabel: string
  settledAt: string | null
}

export interface ResidentTasksSummary {
  open: ResidentTaskItem[]
  recentDone: ResidentTaskItem[]
  needsAttention: boolean
}

const DAY_MS = 86_400_000

function toItem(row: ResidentTaskRow): ResidentTaskItem {
  const status = row.status as TaskStatus
  return {
    id: row.id,
    title: row.title,
    shiftDate: row.shift_date,
    shiftName: row.shift_definitions?.name ?? null,
    dueTime: row.due_time ? row.due_time.slice(0, 5) : null,
    status,
    statusLabel: statusLabel(status),
    sourceLabel: sourceLabel(row.source as TaskSource, row.carried_from_task_id),
    assigneeLabel: row.assignee_user_id ? 'Przypisane do osoby' : 'Cała zmiana',
    settledAt: row.settled_at,
  }
}

const chronological = (a: ResidentTaskItem, b: ResidentTaskItem) =>
  a.shiftDate.localeCompare(b.shiftDate) || (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99') || a.title.localeCompare(b.title, 'pl')

export function summarizeResidentTasks(rows: ResidentTaskRow[], now: Date): ResidentTasksSummary {
  // Przeniesione zadanie zostaje w historii jako oryginał, ale na karcie liczy się jego kopia na kolejnej zmianie
  const carriedOut = new Set(rows.map((r) => r.carried_from_task_id).filter((id): id is string => !!id))
  const since = now.getTime() - RECENT_DONE_DAYS * DAY_MS

  const open = rows
    .filter((r) => (r.status === 'TODO' || r.status === 'PROPOSED') && !carriedOut.has(r.id))
    .map(toItem)
    .sort(chronological)

  const recentDone = rows
    .filter((r) => r.status === 'DONE' && r.settled_at !== null && new Date(r.settled_at).getTime() >= since)
    .map(toItem)
    .sort((a, b) => (b.settledAt ?? '').localeCompare(a.settledAt ?? ''))

  return { open, recentDone, needsAttention: open.some((t) => t.status === 'TODO') }
}
