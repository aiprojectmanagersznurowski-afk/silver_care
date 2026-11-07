import { sourceLabel, type TaskView } from '@/lib/shifts/shift-tasks-view'

/**
 * Wydruk planu pracy (NUR-SHIFT-PLAN-PRINT, SC-NUR-16): pola wyłącznie z SHIFT_TASK_POLICY.printFields —
 * bez PESEL, kontaktów i danych z karty (minimalizacja danych, RODO art. 9). Na wydruku tylko zadania „Do zrobienia”.
 */
export const PRINT_FIELDS = ['resident_name', 'room', 'bed', 'task_title', 'due_time', 'source_label', 'assignee'] as const

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

const collator = new Intl.Collator('pl', { numeric: true })

export function buildPrintSections(tasks: TaskView[]): PrintSection[] {
  const sections = new Map<string, PrintSection & { sort: string }>()
  for (const t of tasks.filter((x) => x.status === 'TODO')) {
    const facility = !t.residentId
    const key = facility ? 'facility' : `room:${t.room ?? ''}`
    const section = sections.get(key) ?? {
      heading: facility ? 'Zadania placówki' : t.room ? `Pokój ${t.room}` : 'Bez pokoju',
      rows: [],
      sort: facility ? '￿' : (t.room ?? '￾'),
    }
    section.rows.push({
      resident: t.residentName ?? '',
      place: [t.room ? `pokój ${t.room}` : null, t.bed ? `łóżko ${t.bed}` : null].filter(Boolean).join(', '),
      title: t.title,
      dueTime: t.dueTime ? t.dueTime.slice(0, 5) : '',
      source: sourceLabel(t.source, t.carriedFromTaskId),
      assignee: 'Cała zmiana',
    })
    sections.set(key, section)
  }
  return [...sections.values()]
    .sort((a, b) => collator.compare(a.sort, b.sort))
    .map(({ sort: _sort, ...section }) => ({
      ...section,
      rows: [...section.rows].sort((a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99') || a.resident.localeCompare(b.resident, 'pl')),
    }))
}
