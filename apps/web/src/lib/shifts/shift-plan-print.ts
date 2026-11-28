import { SHIFT_TASK_POLICY } from '@silvercare/contracts/src/generated/facility'
import { assigneeLabel, groupTasks, sourceLabel, type TaskGroupMode, type TaskView } from '@/lib/shifts/shift-tasks-view'

/**
 * Dane zadań na wydruku (NUR-SHIFT-PLAN-PRINT, SC-NUR-15) ogranicza SHIFT_TASK_POLICY.printFields.
 * Na wydruku są tylko zadania „Do zrobienia”.
 */
export const PRINT_FIELDS = SHIFT_TASK_POLICY.printFields

export interface PrintRow {
  resident: string
  place: string
  title: string
  dueTime: string
  source: string
  assignee: string
}

export interface PrintSection {
  heading: string
  rows: PrintRow[]
}

export function buildPrintSections(
  tasks: TaskView[],
  groupBy: Extract<TaskGroupMode, 'room' | 'resident'> = 'room',
  carriedOut: string[] = [],
): PrintSection[] {
  return groupTasks(tasks, groupBy, carriedOut).flatMap(({ label, tasks: group }) => {
    const rows = group.filter(({ status }) => status === 'TODO').map((task) => ({
      resident: task.residentName ?? '',
      place: [task.room ? `pokój ${task.room}` : null, task.bed ? `łóżko ${task.bed}` : null].filter(Boolean).join(', '),
      title: task.title,
      dueTime: task.dueTime?.slice(0, 5) ?? '',
      source: sourceLabel(task.source, task.carriedFromTaskId),
      assignee: task.assigneeUserId ? assigneeLabel(task) : 'Cała zmiana',
    }))
    rows.sort((a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99') || a.resident.localeCompare(b.resident, 'pl'))
    return rows.length ? [{ heading: label, rows }] : []
  })
}
