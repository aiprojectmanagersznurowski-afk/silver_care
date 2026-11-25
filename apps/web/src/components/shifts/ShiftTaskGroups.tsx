import { TableCard } from '@/components/patterns/TableCard'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ShiftTaskActions, type CarryTarget } from '@/components/shifts/ShiftTaskActions'
import type { ShiftAssigneeOption } from '@/lib/shifts/shift-tasks-data'
import type { ShiftTaskVoiceEvidence } from '@/lib/shifts/shift-task-voice-evidence'
import { ShiftTaskVoiceEvidencePanel } from './ShiftTaskVoiceEvidencePanel'
import { assigneeLabel, sourceLabel, statusLabel, type TaskGroup } from '@/lib/shifts/shift-tasks-view'

interface ShiftTaskGroupsProps {
  groups: TaskGroup[]
  showResident?: boolean
  shiftDate: string
  canSettle: boolean
  targets: CarryTarget[]
  assignees: ShiftAssigneeOption[]
  evidenceByTask: Map<string, ShiftTaskVoiceEvidence[]>
}

/** Zadania zmiany pogrupowane per pokój albo per podopieczny. Źródło widoczne przy każdym zadaniu. */
export function ShiftTaskGroups({ groups, shiftDate, canSettle, targets, assignees, evidenceByTask, showResident }: ShiftTaskGroupsProps) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.key} data-testid="task-group">
          <TableCard title={group.label}>
            <Table aria-label={group.label}>
              <TableHeader className="text-muted-foreground">
                <TableRow>
                  <TableHead>Zadanie</TableHead>
                  {showResident && <TableHead>Podopieczny</TableHead>}
                  <TableHead className="w-24">Godzina</TableHead>
                  <TableHead>Źródło</TableHead>
                  <TableHead>Przypisanie</TableHead>
                  <TableHead>Status</TableHead>
                  {canSettle && <TableHead>Działania</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.tasks.map((t) => (
                  <TableRow key={t.id} data-testid="task-row">
                    <TableCell className="font-medium text-foreground">
                      {t.title}
                      {t.cancelReason && <span className="block text-xs font-normal text-muted-foreground">Powód: {t.cancelReason}</span>}
                    </TableCell>
                    {showResident && <TableCell>{t.residentId ? t.residentName ?? 'Podopieczny' : 'Placówka'}</TableCell>}
                    <TableCell className="text-muted-foreground">{t.dueTime ? t.dueTime.slice(0, 5) : '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{sourceLabel(t.source, t.carriedFromTaskId)}</TableCell>
                    <TableCell>{t.assigneeUserId ? assigneeLabel(t) : 'Zadanie wspólne'}</TableCell>
                    <TableCell>
                      <StatusBadge tone={t.status === 'TODO' ? 'brand' : 'neutral'}>{statusLabel(t.status)}</StatusBadge>
                    </TableCell>
                    {canSettle && (
                      <TableCell>
                        {t.status === 'TODO' && evidenceByTask.has(t.id) && (
                          <ShiftTaskVoiceEvidencePanel evidence={evidenceByTask.get(t.id) ?? []} targets={targets} shiftDate={shiftDate} />
                        )}
                        {(t.status === 'PROPOSED' || t.status === 'TODO') && (
                          <ShiftTaskActions key={t.assigneeUserId ?? 'shared'} taskId={t.id} title={t.title} status={t.status} shiftDate={shiftDate}
                            targets={targets} assignees={assignees} assigneeUserId={t.assigneeUserId ?? null} />
                        )}
                      </TableCell>
                    )}
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
