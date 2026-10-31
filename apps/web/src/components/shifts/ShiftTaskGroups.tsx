import { TableCard } from '@/components/patterns/TableCard'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { sourceLabel, statusLabel, type TaskGroup } from '@/lib/shifts/shift-tasks-view'

/** Zadania zmiany pogrupowane per pokój albo per podopieczny. Źródło widoczne przy każdym zadaniu. */
export function ShiftTaskGroups({ groups }: { groups: TaskGroup[] }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.key} data-testid="task-group">
          <TableCard title={group.label}>
            <Table aria-label={group.label}>
              <TableHeader className="text-muted-foreground">
                <TableRow>
                  <TableHead>Zadanie</TableHead>
                  <TableHead className="w-24">Godzina</TableHead>
                  <TableHead>Źródło</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.tasks.map((t) => (
                  <TableRow key={t.id} data-testid="task-row">
                    <TableCell className="font-medium text-foreground">
                      {t.title}
                      {t.cancelReason && <span className="block text-xs font-normal text-muted-foreground">Powód: {t.cancelReason}</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.dueTime ? t.dueTime.slice(0, 5) : '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{sourceLabel(t.source, t.carriedFromTaskId)}</TableCell>
                    <TableCell>
                      <StatusBadge tone={t.status === 'TODO' ? 'brand' : 'neutral'}>{statusLabel(t.status)}</StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        </div>
      ))}
    </div>
  )
}
