import Link from 'next/link'
import { redirect } from 'next/navigation'
import { OPERATIONAL_REPORT_ENGINE, RESIDENT_ASSIGNMENT, VOICE_RETENTION } from '@silvercare/contracts/src/generated/voice'
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
import { ResolveVoiceForm } from './ResolveVoiceForm'

export const dynamic = 'force-dynamic'

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
const time = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Warsaw' })

export default async function VoiceAssignmentPage({ searchParams }: { searchParams: Promise<{ segment?: string }> }) {
  const user = await getCurrentUser()
  const orgId = getAppOrganizationId(user)
  const role = getAppRole(user)
  if (!orgId || (role !== 'org_admin' && role !== 'nurse')) redirect('/voice')
  if (!(await requireOrgFeature(OPERATIONAL_REPORT_ENGINE.moduleKey)).allowed) return <FeatureDisabledState />

  const supabase = await createClient()
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const title = <PageHeader title="Fragmenty do sprawdzenia" back={{ href: '/voice', label: 'Wróć do trybów nagrywania' }} />
  if (assurance?.currentLevel !== 'aal2') {
    return <div className="space-y-4">{title}<FeatureFlagsMfa needsVerification={assurance?.nextLevel === 'aal2'}
      description="Potwierdź drugi składnik uwierzytelniania, aby sprawdzić fragmenty nagrań." /></div>
  }

  const queue = await supabase.from(RESIDENT_ASSIGNMENT.queueResource).select('segment_id, reasons, created_at, shift_date')
    .eq('organization_id', orgId).is('decided_at', null).order('created_at').limit(100)
  const { segment } = await searchParams
  const selected = queue.data?.find((item) => item.segment_id === segment)
  return (
    <div className="space-y-6">
      {title}
      {selected && <AssignmentDetails orgId={orgId} segmentId={selected.segment_id} />}
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Dodano do kolejki</TableHead><TableHead>Data zmiany</TableHead>
              <TableHead>Powód</TableHead><TableHead>Decyzja</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {queue.error && <TableStateRow colSpan={4} state="error" title="Nie udało się pobrać fragmentów" />}
            {!queue.error && !queue.data?.length && <TableStateRow colSpan={4} state="empty" title="Brak fragmentów do sprawdzenia" />}
            {queue.data?.map((row) => (
              <TableRow key={row.segment_id}>
                <TableCell>{time.format(new Date(row.created_at))}</TableCell>
                <TableCell>{row.shift_date ?? 'Do ustalenia'}</TableCell>
                <TableCell className="whitespace-normal">{row.reasons.map((reason) => reasonLabels[reason as keyof typeof reasonLabels]).join(', ')}</TableCell>
                <TableCell><Link href={`?segment=${row.segment_id}`} prefetch={false}
                  className="inline-flex min-h-touch items-center px-2 font-medium underline">Sprawdź fragment</Link></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </div>
  )
}

async function AssignmentDetails({ orgId, segmentId }: { orgId: string; segmentId: string }) {
  // Identyfikator pochodzi z otwartej pozycji odczytanej z RLS, a zapytania usługowe są ponownie ograniczone do placówki.
  const admin = createAdminClient()
  const { data: segment } = await admin.from(RESIDENT_ASSIGNMENT.segmentResource)
    .select('transcript_path, author_id, author_attribution, voice_captures(recorded_at, received_at, clock_state)')
    .eq('organization_id', orgId).eq('id', segmentId).eq('assignment_status', 'PENDING').maybeSingle()
  if (!segment) return <ListError title="Źródło fragmentu jest niedostępne" />
  const transcript = segment.transcript_path
    ? await admin.storage.from(VOICE_RETENTION.storageBucket).download(segment.transcript_path)
    : null
  if (!transcript?.data?.size) {
    return <ListError title="Źródło fragmentu jest niedostępne" action={
      <ResolveVoiceForm key={segmentId} segmentId={segmentId} residents={[]} staff={[]} author={null} unassignableOnly />
    } />
  }
  const sessionDb = await createClient()
  const [residents, staff] = await Promise.all([
    sessionDb.from('residents').select('id, first_name, last_name').eq('organization_id', orgId)
      .order('last_name').limit(1000),
    listShiftStaff(orgId),
  ])
  if (residents.error) return <ListError title="Nie udało się odczytać fragmentu" />
  const author = staff.find(({ id }) => id === segment.author_id)?.label
  const capture = segment.voice_captures
  const capturedAt = capture?.clock_state === 'UNKNOWN' ? 'do ustalenia' : capture?.recorded_at && time.format(new Date(capture.recorded_at))
  const receivedAt = capture?.received_at && time.format(new Date(capture.received_at))
  const attribution = attributionLabels[segment.author_attribution as keyof typeof attributionLabels]
  return (
    <section className="space-y-4 rounded-lg border border-border p-4" aria-label="Decyzja o przypisaniu">
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Czas nagrania</dt><dd>{capturedAt ?? 'Do ustalenia'}</dd></div>
        <div><dt className="text-muted-foreground">Przyjęto w systemie</dt><dd>{receivedAt ?? 'Brak danych'}</dd></div>
        <div><dt className="text-muted-foreground">Autor</dt><dd>{author ?? 'Do ustalenia'} · {attribution}</dd></div>
      </dl>
      <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{await transcript.data.text()}</p>
      <ResolveVoiceForm key={segmentId} segmentId={segmentId} author={segment.author_id}
        residents={(residents.data ?? []).map(({ id, first_name, last_name }) => ({ id, label: `${last_name} ${first_name}` }))}
        staff={staff} />
    </section>
  )
}
