import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SHIFT_POLICY } from '@silvercare/contracts/src/generated/facility'
import { OPERATIONAL_REPORT_ENGINE, RESIDENT_ASSIGNMENT, VOICE_RETENTION } from '@silvercare/contracts/src/generated/voice'
import { staffMfaSatisfied } from '@/lib/auth/staff-mfa'
import { FeatureFlagsMfa } from '@/components/admin/FeatureFlagsMfa'
import { FeatureDisabledState } from '@/components/patterns/FeatureDisabledState'
import { ListError } from '@/components/patterns/ListState'
import { PageHeader } from '@/components/patterns/PageHeader'
import { TableCard, TableStateRow } from '@/components/patterns/TableCard'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getAppOrganizationId, getAppRole } from '@/lib/auth/app-role'
import { requireOrgFeature } from '@/lib/feature-flags'
import { listShiftStaff } from '@/lib/shifts/shift-staff'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'
import { ResolveVoiceForm } from './ResolveVoiceForm'
import { VoiceSplitReview, VoiceTimeCorrection } from './SourceReviewForm'

export const dynamic = 'force-dynamic'

const review = RESIDENT_ASSIGNMENT.sourceReview
const reasonLabels: Record<(typeof RESIDENT_ASSIGNMENT.reviewReasons)[number], string> = {
  NO_MATCH: 'Brak dopasowania podopiecznego',
  MULTIPLE_MATCHES: 'Więcej niż jedno dopasowanie',
  CONFLICTING_EVIDENCE: 'Sprzeczne informacje',
  MIXED_SEGMENT: 'Kilka spraw w jednym fragmencie',
  NO_AUTHOR: 'Autor nieustalony',
  TIME_UNCERTAIN: 'Czas nagrania niepewny',
}
const attributionLabels: Record<(typeof RESIDENT_ASSIGNMENT.authorAttribution)[number], string> = {
  AUTHENTICATED_SESSION: 'Sesja webowa',
  DECLARED_SESSION: 'Deklaracja w nagraniu',
  MANUAL_SEGMENT_CORRECTION: 'Ręczne ustalenie autora',
  UNKNOWN: 'Autor nieustalony',
}
const clockLabels: Record<string, string> = { SYNCED: 'Zsynchronizowany', RELATIVE: 'Czas względny', UNKNOWN: 'Niepewny' }
const time = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'medium', timeZone: SHIFT_POLICY.timezone })

type QueueItem = Pick<Database['public']['Tables']['voice_assignment_queue']['Row'],
  'segment_id' | 'reasons' | 'created_at' | 'shift_date' | 'shift_definition_id' | 'version'>
type Shift = { id: string; name: string }

function queueHref(page: number, segment?: string) {
  const params = new URLSearchParams()
  if (page > 1) params.set('page', String(page))
  if (segment) params.set('segment', segment)
  return `/voice/assignment${params.size ? `?${params}` : ''}`
}

function shiftLabel(row: QueueItem, shifts: Shift[]) {
  if (!row.shift_date) return 'Do ustalenia'
  const shift = shifts.find(({ id }) => id === row.shift_definition_id)
  return shift ? `${shift.name} · ${row.shift_date}` : row.shift_date
}

function Timestamp({ value, fallback = 'Do ustalenia' }: { value?: string | null; fallback?: string }) {
  return value ? <time dateTime={value}>{time.format(new Date(value))}</time> : fallback
}

export default async function VoiceAssignmentPage({ searchParams }: { searchParams: Promise<{ segment?: string; page?: string }> }) {
  const user = await getCurrentUser()
  const orgId = getAppOrganizationId(user)
  const role = getAppRole(user)
  if (!orgId || (role !== review.facilityRole && role !== review.shiftLeadRole)) redirect('/voice')
  if (!(await requireOrgFeature(OPERATIONAL_REPORT_ENGINE.moduleKey)).allowed) return <FeatureDisabledState />

  const supabase = await createClient()
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const title = <PageHeader title="Fragmenty do sprawdzenia" back={{ href: '/voice', label: 'Wróć do trybów nagrywania' }} />
  if (!await staffMfaSatisfied(supabase, assurance?.currentLevel, review.requiredAal)) {
    return <div className="space-y-4">{title}<FeatureFlagsMfa needsVerification={assurance?.nextLevel === review.requiredAal}
      description="Potwierdź drugi składnik uwierzytelniania, aby sprawdzić fragmenty nagrań." /></div>
  }

  const params = await searchParams
  const pageNumber = Number(params.page)
  const page = Number.isSafeInteger(pageNumber) && pageNumber > 0 && pageNumber <= 1_000_000 ? pageNumber : 1
  const offset = (page - 1) * review.queuePageSize
  const openItems = () => supabase.from(RESIDENT_ASSIGNMENT.queueResource)
    .select('segment_id, reasons, created_at, shift_date, shift_definition_id, version')
    .eq('organization_id', orgId).is('decided_at', null)
  const segmentId = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(params.segment ?? '') ? params.segment : undefined
  const [queue, selected, definitions] = await Promise.all([
    openItems().order('created_at').order('segment_id').range(offset, offset + review.queuePageSize),
    segmentId ? openItems().eq('segment_id', segmentId).maybeSingle() : null,
    supabase.from('shift_definitions').select('id, name').eq('organization_id', orgId).eq('is_active', true)
      .order('start_time').limit(SHIFT_POLICY.shiftsPerDay.max),
  ])
  const shifts = definitions.data ?? []
  const rows = queue.data?.slice(0, review.queuePageSize) ?? []
  const hasNext = (queue.data?.length ?? 0) > review.queuePageSize
  return (
    <div className="space-y-6">
      {title}
      {selected?.data && <AssignmentDetails orgId={orgId} item={selected.data} shifts={shifts}
        facilityManager={role === review.facilityRole} queueHref={queueHref(page)} />}
      {segmentId && !selected?.data && <ListError title="Fragment nie jest już dostępny w kolejce" />}
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Dodano do kolejki</TableHead><TableHead>Zmiana</TableHead>
              <TableHead>Powód</TableHead><TableHead>Decyzja</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {queue.error && <TableStateRow colSpan={4} state="error" title="Nie udało się pobrać fragmentów" />}
            {!queue.error && rows.length === 0 && <TableStateRow colSpan={4} state="empty" title="Brak fragmentów do sprawdzenia" />}
            {rows.map((row) => (
              <TableRow key={row.segment_id}>
                <TableCell><Timestamp value={row.created_at} /></TableCell>
                <TableCell>{shiftLabel(row, shifts)}</TableCell>
                <TableCell className="whitespace-normal">{row.reasons.map((reason) => reasonLabels[reason as keyof typeof reasonLabels]).join(', ')}</TableCell>
                <TableCell><Link href={queueHref(page, row.segment_id)} prefetch={false}
                  className="inline-flex min-h-touch min-w-touch items-center px-2 font-medium underline">Sprawdź fragment</Link></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
      {(page > 1 || hasNext) && <nav aria-label="Strony kolejki" className="flex flex-wrap items-center gap-3">
        {page > 1 && <Link href={queueHref(page - 1)} className="inline-flex min-h-touch min-w-touch items-center underline">Poprzednia</Link>}
        <span>Strona {page}</span>
        {hasNext && <Link href={queueHref(page + 1)} className="inline-flex min-h-touch min-w-touch items-center underline">Następna</Link>}
      </nav>}
    </div>
  )
}

async function AssignmentDetails({ orgId, item, shifts, facilityManager, queueHref }: {
  orgId: string; item: QueueItem; shifts: Shift[]; facilityManager: boolean; queueHref: string
}) {
  const segmentId = item.segment_id
  const position = { segmentId, version: item.version, queueHref }
  const key = `${segmentId}:${item.version}`
  const mixed = item.reasons.includes('MIXED_SEGMENT')
  // Pozycja pochodzi z otwartej kolejki odczytanej przez RLS. Zapytania usługowe pozostają w tej placówce.
  const admin = createAdminClient()
  const sessionDb = await createClient()
  const [details, audio] = await Promise.all([
    admin.from(RESIDENT_ASSIGNMENT.segmentResource)
      .select('transcript_path, author_id, author_attribution, start_ms, end_ms, corrected_at, derived_start_at, event_occurred_at, transcription_status, voice_captures(recorded_at, received_at, clock_state, source, selected_resident_id)')
      .eq('organization_id', orgId).eq('id', segmentId).eq('assignment_status', 'PENDING').maybeSingle(),
    mixed ? sessionDb.rpc('can_play_voice_segment', { p_segment_id: segmentId }) : null,
  ])
  const segment = details.data
  const capture = segment?.voice_captures
  if (!segment || !capture) {
    return <ListError title="Źródło fragmentu jest niedostępne" />
  }

  const [transcript, staff] = await Promise.all([
    segment.transcript_path ? admin.storage.from(VOICE_RETENTION.storageBucket).download(segment.transcript_path) : null,
    listShiftStaff(orgId),
  ])
  const current = await sessionDb.from(RESIDENT_ASSIGNMENT.queueResource).select('segment_id')
    .eq('segment_id', segmentId).eq('organization_id', orgId).eq('version', item.version).is('decided_at', null).maybeSingle()
  if (!current.data) return <ListError title="Stan fragmentu się zmienił. Odśwież kolejkę." />

  const transcriptBody = transcript?.data?.size ? transcript.data : null
  const unassignableOnly = !transcriptBody || review.sourceReasons.some((reason) => item.reasons.includes(reason))
  const fixedResident = capture.source === RESIDENT_ASSIGNMENT.selectedResidentReview.source
    ? capture.selected_resident_id : null
  const residentQuery = sessionDb.from('residents').select('id, first_name, last_name').eq('organization_id', orgId)
  const residents = unassignableOnly ? null : await (fixedResident
    ? residentQuery.eq('id', fixedResident).is('archived_at', null)
    : residentQuery.order('last_name').limit(1000))
  const author = staff.find(({ id }) => id === segment.author_id)?.label
  const attribution = attributionLabels[segment.author_attribution as keyof typeof attributionLabels]
  return (
    <section className="space-y-4 rounded-lg border border-border p-4" aria-label="Decyzja o przypisaniu">
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Czas źródłowy</dt><dd><Timestamp value={capture.recorded_at} /></dd></div>
        <div><dt className="text-muted-foreground">Stan zegara źródła</dt><dd>{clockLabels[capture.clock_state] ?? 'Brak danych'}</dd></div>
        <div><dt className="text-muted-foreground">Przyjęto w systemie</dt><dd><Timestamp value={capture.received_at} /></dd></div>
        <div><dt className="text-muted-foreground">Czas zweryfikowany</dt><dd><Timestamp value={segment.corrected_at} /></dd></div>
        {segment.derived_start_at && <div><dt className="text-muted-foreground">Początek w źródle</dt><dd><Timestamp value={segment.derived_start_at} /></dd></div>}
        <div><dt className="text-muted-foreground">Czas opisywanego zdarzenia</dt><dd><Timestamp value={segment.event_occurred_at} /></dd></div>
        <div><dt className="text-muted-foreground">Przypisana zmiana</dt><dd>{shiftLabel(item, shifts)}</dd></div>
        <div><dt className="text-muted-foreground">Autor</dt><dd>{author ?? 'Do ustalenia'} · {attribution}</dd></div>
      </dl>
      {!transcriptBody ? (['WAITING', 'PROCESSING'].includes(segment.transcription_status ?? '')
        ? <p role="status" className="text-muted-foreground">Część oczekuje na prywatną transkrypcję.</p>
        : <ListError title="Źródło fragmentu jest niedostępne" />)
        : <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{await transcriptBody.text()}</p>}
      <VoiceTimeCorrection key={key} position={position} shiftId={item.shift_definition_id} shiftDate={item.shift_date}
        shifts={facilityManager ? shifts : shifts.filter(({ id }) => id === item.shift_definition_id)} />
      {mixed && <VoiceSplitReview key={`split:${key}`} position={position} startMs={segment.start_ms}
        endMs={segment.end_ms} audioAvailable={audio?.data === true} />}
      {residents?.error ? <ListError title="Nie udało się pobrać podopiecznych" /> : <ResolveVoiceForm key={`scope:${key}`}
        position={position} author={segment.author_id} fixedResident={fixedResident}
        unassignableOnly={unassignableOnly || Boolean(fixedResident && !residents?.data?.length)}
        residents={(residents?.data ?? []).map(({ id, first_name, last_name }) => ({ id, label: `${last_name} ${first_name}` }))}
        staff={staff} />}
    </section>
  )
}
