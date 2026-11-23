import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { ListEmpty, ListError } from '@/components/patterns/ListState'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { TableCard } from '@/components/patterns/TableCard'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  completenessLabels, formatHandoverTime, handoverAuthorLabel, handoverSourceLabel,
  type HandoverDraft, type HandoverFact, type HandoverTaskState, type ShiftHandoverAuditEvent,
} from '@/lib/shifts/shift-handover'
import { statusLabel, type TaskView } from '@/lib/shifts/shift-tasks-view'
import { ShiftHandoverForm } from './ShiftHandoverForm'

const auditLabels: Record<string, string> = {
  SHIFT_TASK_CREATED: 'Dodano zadanie',
  SHIFT_TASK_STATUS_CHANGED: 'Zmieniono status zadania',
  SHIFT_TASK_ASSIGNEE_CHANGED: 'Zmieniono przypisanie',
  SHIFT_TASK_CARRIED: 'Przeniesiono zadanie',
  SHIFT_PLAN_APPROVED: 'Zatwierdzono plan',
  SHIFT_PLAN_PRINTED: 'Wydrukowano plan',
  SHIFT_HANDOVER_APPROVED: 'Zatwierdzono przekazanie',
  SHIFT_HANDOVER_AMENDMENT_APPROVED: 'Zatwierdzono aneks',
  SHIFT_HANDOVER_ACKNOWLEDGED: 'Historyczne potwierdzenie odbioru',
  VOICE_SHIFT_TASK_DECIDED: 'Rozpatrzono podpowiedź głosową',
}

interface Props {
  supabase: SupabaseClient<Database>
  shiftId: string
  date: string
  tasks: TaskView[]
  auditPage: number
  auditPageHref: (page: number) => string
}

export async function ShiftHandoverReview({ supabase, shiftId, date, tasks, auditPage, auditPageHref }: Props) {
  const [preview, audit] = await Promise.all([
    supabase.rpc('preview_shift_handover', { p_shift: shiftId, p_date: date }),
    supabase.rpc('read_shift_handover_audit', { p_shift: shiftId, p_date: date, p_offset: (auditPage - 1) * 50 }),
  ])
  const draft = preview.data as unknown as HandoverDraft | null
  const events = (audit.data ?? []) as unknown as ShiftHandoverAuditEvent[]
  if (!draft || preview.error) {
    return <ListError title="Nie udało się wczytać przekazania" />
  }

  const taskNames = new Map(tasks.map((task) => [task.id, task.title]))
  const amendment = draft.latestVersion !== null
  const { nextShift } = draft
  return (
    <section id="zamkniecie-zmiany" aria-label="Zamknięcie zmiany" className="space-y-5 rounded-lg border p-4">
      <h2 className="text-base font-semibold">Zamknięcie zmiany</h2>
      {nextShift.code && (
        <Link className="inline-flex min-h-touch items-center text-sm underline"
          href={`/staff/shift-tasks?${new URLSearchParams({ shift: nextShift.code, date: nextShift.date })}`}>
          Plan następnej zmiany · {nextShift.name} · {nextShift.date}
        </Link>
      )}
      {draft.canApprove && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">{amendment ? 'Propozycja aneksu' : 'Przekazanie do zatwierdzenia'}</h3>
          <div className="space-y-1">
            <Link href="/voice/assignment" className="inline-flex min-h-touch items-center text-sm underline">
              Fragmenty do sprawdzenia · {draft.exceptions}
            </Link>
            {amendment && draft.newReceipts > 0 && <p className="text-sm">Nowe dowody przyjęcia · {draft.newReceipts}</p>}
            {draft.pendingSources > 0 && <p className="text-sm">Źródła bez pełnego potwierdzenia · {draft.pendingSources}</p>}
            {draft.unknownAuthors > 0 && <p className="text-sm">Brak rozpoznania autora · {draft.unknownAuthors}</p>}
          </div>
          <HandoverFacts facts={draft.facts} />
          {!amendment && <HandoverTasks states={draft.tasks} names={taskNames} />}
          <ShiftHandoverForm key={draft.revision} shiftId={shiftId} date={date} revision={draft.revision}
            amendment={amendment} receipts={draft.receipts} incompleteSources={draft.exceptions + draft.pendingSources} />
        </div>
      )}
      {draft.versions.map((version) => (
        <details key={version.version} className="space-y-3 rounded-lg border p-3">
          <summary className="min-h-touch cursor-pointer space-x-2 py-2 text-sm font-medium">
            <span>{version.previousVersion === null ? 'Przekazanie' : 'Aneks'}, wersja {version.version}</span>
            <StatusBadge tone="neutral">Zatwierdzone</StatusBadge>
          </summary>
          <p className="text-sm">{completenessLabels[version.completeness]} · {formatHandoverTime(version.approvedAt)}</p>
          <p className="break-all text-sm">Zatwierdził {version.approvedBy}</p>
          {version.previousVersion !== null && <p className="text-sm">Uzupełnia wersję {version.previousVersion}</p>}
          {version.expectedSourceIds.length > 0 && (
            <p className="break-all text-sm">Dowody przyjęcia · {version.expectedSourceIds.join(', ')}</p>
          )}
          {version.reason && <p className="text-sm">Powód · {version.reason}</p>}
          <HandoverFacts facts={version.facts} />
          <HandoverTasks states={version.tasks} names={taskNames} />
        </details>
      ))}
      {audit.error ? <ListError title="Nie udało się wczytać historii zmiany" /> : (
        <details className="space-y-3 rounded-lg border p-3" open={auditPage > 1 || undefined}>
          <summary className="min-h-touch cursor-pointer py-2 text-sm font-medium">Historia zmiany</summary>
          {events.length ? (
            <TableCard title="Zdarzenia audytowe">
              <Table aria-label="Zdarzenia audytowe">
                <TableHeader><TableRow><TableHead>Czas</TableHead><TableHead>Zdarzenie</TableHead><TableHead>Aktor</TableHead>
                  <TableHead>Zadanie</TableHead><TableHead>Wersja</TableHead></TableRow></TableHeader>
                <TableBody>{events.slice(0, 50).map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{formatHandoverTime(event.at)}</TableCell>
                    <TableCell>{auditLabels[event.action] ?? event.action}{event.to && ` · ${statusLabel(event.to)}`}</TableCell>
                    <TableCell>{event.actor ?? 'System'}</TableCell>
                    <TableCell>{event.taskId ? taskNames.get(event.taskId) ?? event.taskId : '—'}</TableCell>
                    <TableCell>{event.version ?? '—'}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </TableCard>
          ) : <ListEmpty title="Brak zdarzeń audytowych" />}
          <nav aria-label="Strony historii zmiany" className="flex flex-wrap gap-3 text-sm">
            {auditPage > 1 && <Link className="inline-flex min-h-touch items-center underline" href={auditPageHref(auditPage - 1)}>Poprzednia strona historii</Link>}
            {events.length > 50 && <Link className="inline-flex min-h-touch items-center underline" href={auditPageHref(auditPage + 1)}>Następna strona historii</Link>}
          </nav>
        </details>
      )}
    </section>
  )
}

function HandoverFacts({ facts }: { facts: HandoverFact[] }) {
  if (facts.length === 0) return <p className="text-sm text-muted-foreground">Brak dopuszczonych faktów w tej wersji.</p>
  return (
    <TableCard title="Dopuszczone fakty">
      <Table aria-label="Dopuszczone fakty">
        <TableHeader><TableRow><TableHead>Fakt</TableHead><TableHead>Źródło</TableHead><TableHead>Autorstwo</TableHead></TableRow></TableHeader>
        <TableBody>{facts.map((fact) => (
          <TableRow key={`${fact.kind}/${fact.id}`}>
            <TableCell className="whitespace-pre-line">
              <span>{fact.text ?? 'Treść źródła jest niedostępna'}</span>
              <span className="block text-xs text-muted-foreground">{fact.residentId ? 'Sprawa podopiecznego' : 'Sprawa placówki'}</span>
            </TableCell>
            <TableCell>
              {handoverSourceLabel(fact.source)} · {formatHandoverTime(fact.recordedAt)}
              <span className="block text-xs text-muted-foreground">Przyjęto {formatHandoverTime(fact.receivedAt)} · {fact.sourceId}</span>
            </TableCell>
            <TableCell>{handoverAuthorLabel(fact.attribution)}</TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
    </TableCard>
  )
}

function HandoverTasks({ states, names }: { states: HandoverTaskState[]; names: Map<string, string> }) {
  if (!states.length) return <p className="text-sm text-muted-foreground">Brak zadań do rozliczenia.</p>
  return (
    <TableCard title="Rozliczenie i otwarte sprawy">
      <Table aria-label="Rozliczenie i otwarte sprawy">
        <TableHeader><TableRow><TableHead>Zadanie</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>{states.map((task) => (
          <TableRow key={task.id}>
            <TableCell>{names.get(task.id) ?? task.id}</TableCell>
            <TableCell>{task.carriedToTaskId ? 'Przeniesione' : statusLabel(task.status)}</TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
    </TableCard>
  )
}
