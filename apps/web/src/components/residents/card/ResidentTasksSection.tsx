import Link from 'next/link'
import { CheckCircle2, ListTodo } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { ListEmpty } from '@/components/patterns/ListState'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { RECENT_DONE_DAYS, type ResidentTaskItem, type ResidentTasksSummary } from '@/lib/resident-card/resident-tasks'

const day = (iso: string) => iso.slice(0, 10).split('-').reverse().join('.')

interface ResidentTasksSectionProps {
  tasks: ResidentTasksSummary
  /** Lista zadań zmiany z wybranym tym podopiecznym. */
  addTaskHref: string
}

function TaskRow({ task, done }: { task: ResidentTaskItem; done?: boolean }) {
  const when = [day(task.shiftDate), task.shiftName, task.dueTime].filter(Boolean).join(' · ')
  return (
    <li data-testid="resident-task" className="flex min-h-touch flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-foreground">{task.title}</span>
        <span className="text-xs text-muted-foreground">
          {when} · {task.sourceLabel} · {task.assigneeLabel}
          {done && task.settledAt ? ` · rozliczone ${day(task.settledAt)}` : ''}
        </span>
      </div>
      <StatusBadge tone={task.status === 'TODO' ? 'brand' : 'neutral'}>{task.statusLabel}</StatusBadge>
    </li>
  )
}

/**
 * Zadania podopiecznego na karcie (SC-ADM-21): otwarte i wykonane w ostatnich dniach, jako fakty.
 * Kolor nie niesie oceny — ton marki tylko dla zadania do zrobienia.
 */
export function ResidentTasksSection({ tasks, addTaskHref }: ResidentTasksSectionProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Otwarte zadania</CardTitle>
          <Link href={addTaskHref} className={buttonVariants({ variant: 'outline' })}>
            Dodaj zadanie
          </Link>
        </CardHeader>
        <CardContent>
          {tasks.open.length === 0 ? (
            <ListEmpty icon={<ListTodo />} title="Brak otwartych zadań" description="Ten podopieczny nie ma zadań do zrobienia ani propozycji." />
          ) : (
            <ul data-testid="resident-tasks-open" className="divide-y divide-border">
              {tasks.open.map((t) => <TaskRow key={t.id} task={t} />)}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wykonane w ostatnich {RECENT_DONE_DAYS} dniach</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.recentDone.length === 0 ? (
            <ListEmpty icon={<CheckCircle2 />} title="Brak wykonanych zadań" description={`W ostatnich ${RECENT_DONE_DAYS} dniach nie rozliczono zadań tego podopiecznego.`} />
          ) : (
            <ul data-testid="resident-tasks-done" className="divide-y divide-border">
              {tasks.recentDone.map((t) => <TaskRow key={t.id} task={t} done />)}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
