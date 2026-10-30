/**
 * Widok zadań zmiany (NUR-TASKS, SC-NUR-13/15): etykiety źródła i statusu, grupowanie, walidacja nowego zadania.
 * Zadania są poleceniami personelu — żadnej oceny stanu zdrowia ani koloru niosącego ocenę.
 */
export type TaskSource = 'MANUAL' | 'HANDOVER' | 'CARE_PLAN'
export type TaskStatus = 'PROPOSED' | 'TODO' | 'DONE' | 'CANCELLED'
export type TaskGroupMode = 'room' | 'resident'

export interface TaskView {
  id: string
  title: string
  dueTime: string | null
  source: TaskSource
  status: TaskStatus
  carriedFromTaskId: string | null
  residentId: string | null
  residentName: string | null
  room: string | null
  bed: string | null
  cancelReason: string | null
}

export interface TaskGroup {
  key: string
  label: string
  tasks: TaskView[]
}

const SOURCE_LABELS: Record<TaskSource, string> = {
  MANUAL: 'Ręczne',
  HANDOVER: 'Z przekazania',
  CARE_PLAN: 'Z planu opieki',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  PROPOSED: 'Propozycja',
  TODO: 'Do zrobienia',
  DONE: 'Wykonane',
  CANCELLED: 'Anulowane',
}

export const TITLE_MAX = 300
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function sourceLabel(source: TaskSource, carriedFromTaskId: string | null): string {
  return carriedFromTaskId ? 'Przeniesione z poprzedniej zmiany' : SOURCE_LABELS[source]
}

export function statusLabel(status: TaskStatus): string {
  return STATUS_LABELS[status]
}

export function normalizeGroupParam(value: string | undefined): TaskGroupMode {
  return value === 'resident' ? 'resident' : 'room'
}

export function validateTaskInput(input: { title: string; dueTime: string }): string | null {
  const title = input.title.trim()
  if (!title) return 'Podaj treść zadania.'
  if (title.length > TITLE_MAX) return `Treść zadania może mieć najwyżej ${TITLE_MAX} znaków.`
  if (input.dueTime && !TIME_RE.test(input.dueTime)) return 'Podaj godzinę w formacie GG:MM.'
  return null
}

const byTime = (a: TaskView, b: TaskView) =>
  (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99') || a.title.localeCompare(b.title, 'pl')

const collator = new Intl.Collator('pl', { numeric: true })

/** Zadanie z przeniesioną kopią zostaje w historii, ale nie wisi drugi raz na liście. */
export function groupTasks(tasks: TaskView[], mode: TaskGroupMode): TaskGroup[] {
  const carried = new Set(tasks.map((t) => t.carriedFromTaskId).filter((id): id is string => !!id))
  const visible = tasks.filter((t) => !carried.has(t.id))

  const buckets = new Map<string, TaskGroup & { sort: string }>()
  for (const t of visible) {
    let key: string
    let label: string
    let sort: string
    if (!t.residentId) {
      key = 'facility'; label = 'Zadania placówki'; sort = '￿'
    } else if (mode === 'room') {
      key = `room:${t.room ?? ''}`
      label = t.room ? `Pokój ${t.room}` : 'Bez pokoju'
      sort = t.room ?? '￾'
    } else {
      key = `resident:${t.residentId}`
      const place = [t.room ? `pokój ${t.room}` : null, t.bed ? `łóżko ${t.bed}` : null].filter(Boolean).join(', ')
      label = `${t.residentName ?? 'Podopieczny'}${place ? ` · ${place}` : ''}`
      sort = t.residentName ?? '' // nazwa podopiecznego jest już w formacie „Nazwisko Imię”
    }
    const bucket = buckets.get(key) ?? { key, label, tasks: [], sort }
    bucket.tasks.push(t)
    buckets.set(key, bucket)
  }

  return [...buckets.values()]
    .sort((a, b) => (a.sort === b.sort ? 0 : a.sort === '￿' ? 1 : b.sort === '￿' ? -1 : collator.compare(a.sort, b.sort)))
    .map(({ sort: _sort, ...group }) => ({ ...group, tasks: [...group.tasks].sort(byTime) }))
}
