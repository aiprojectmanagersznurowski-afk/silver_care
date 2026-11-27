import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/patterns/PageHeader'
import { ListError } from '@/components/patterns/ListState'
import { authorizeShiftStaff, getShiftStaffAccess } from '@/lib/api-auth'
import { parseAuditDate } from '@/lib/audit-helpers'
import {
  formatHandoverTime, handoverAuthorLabel, handoverSourceLabel, type HandoverDraft,
} from '@/lib/shifts/shift-handover'

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

/** @REQ: NUR-SHIFT-CLOSURE — redacted source in the manager's handover scope. */
export default async function ShiftHandoverSourcePage({ searchParams }: {
  searchParams: Promise<{ shift?: string; date?: string; fact?: string; kind?: string }>
}) {
  const { shift, fact: factId, kind, date: requestedDate } = await searchParams
  const date = typeof requestedDate === 'string' ? parseAuditDate(requestedDate) : undefined
  if (typeof shift !== 'string' || !uuid.test(shift) || typeof factId !== 'string' || !uuid.test(factId) || !date
    || (kind !== 'event' && kind !== 'behavior')) notFound()

  const session = await authorizeShiftStaff()
  if (!session || await getShiftStaffAccess(session, shift, date) !== 'manage') notFound()
  const { supabase } = session
  const [preview, shiftResult] = await Promise.all([
    supabase.rpc('preview_shift_handover', { p_shift: shift, p_date: date }),
    supabase.from('shift_definitions').select('code').eq('id', shift).eq('organization_id', session.orgId).maybeSingle(),
  ])
  if (preview.error?.code === '42501') notFound()
  if (preview.error || shiftResult.error) return <ListError title="Nie udało się wczytać źródła faktu" />

  const draft = preview.data as unknown as HandoverDraft | null
  const match = (fact: { id: string; kind: string }) => fact.id === factId && fact.kind === kind
  const archived = draft?.versions.flatMap((version) => version.facts).find(match)
  const fact = draft?.facts.find(match) ?? archived
  if (!fact || !shiftResult.data) notFound()

  const back = '/staff/shift-tasks?' + new URLSearchParams({
    shift: shiftResult.data.code, date, closure: '1',
  }) + '#zamkniecie-zmiany'
  return (
    <div className="space-y-5">
      <PageHeader title="Źródło faktu" description={handoverSourceLabel(fact.source)}
        back={{ href: back, label: 'Wróć do przekazania' }} />
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="font-medium">Czas nagrania</dt><dd>{formatHandoverTime(fact.recordedAt)}</dd></div>
        <div><dt className="font-medium">Czas przyjęcia</dt><dd>{formatHandoverTime(fact.receivedAt)}</dd></div>
        <div><dt className="font-medium">Autorstwo</dt><dd>{handoverAuthorLabel(fact.attribution)}</dd></div>
        <div><dt className="font-medium">Identyfikator źródła</dt><dd className="break-all">{fact.sourceId}</dd></div>
        {fact.captureId && <div><dt className="font-medium">Identyfikator nagrania</dt><dd className="break-all">{fact.captureId}</dd></div>}
      </dl>
      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="font-semibold">Dopuszczona treść źródła</h2>
        <p className="whitespace-pre-line text-sm">{fact.text ?? 'Treść źródła jest niedostępna'}</p>
      </section>
    </div>
  )
}
