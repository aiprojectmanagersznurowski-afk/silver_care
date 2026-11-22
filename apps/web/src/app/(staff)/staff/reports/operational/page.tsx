import Link from 'next/link'
import { redirect } from 'next/navigation'
import { OPERATIONAL_REPORT_ENGINE } from '@silvercare/contracts/src/generated/voice'
import { FeatureFlagsMfa } from '@/components/admin/FeatureFlagsMfa'
import { FeatureDisabledState } from '@/components/patterns/FeatureDisabledState'
import { ListError } from '@/components/patterns/ListState'
import { PageHeader } from '@/components/patterns/PageHeader'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { TableCard, TableStateRow } from '@/components/patterns/TableCard'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getAppOrganizationId, getAppRole } from '@/lib/auth/app-role'
import { requireOrgFeature } from '@/lib/feature-flags'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database.types'
import { ApproveOperationalReport } from './ApproveOperationalReport'

export const dynamic = 'force-dynamic'

const time = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Warsaw' })
const rowStatus = (status: string, requiresRegeneration: boolean) => requiresRegeneration
  ? 'Oczekuje na aktualizację' : status === 'APPROVED' ? 'Zatwierdzony' : 'Szkic'
const sectionLabels = { events: 'Zdarzenia', locations: 'Miejsca', action_items: 'Działania', source_quotes: 'Cytaty źródłowe' }

function sectionValues(content: Record<string, Json | undefined>, name: string) {
  const values = content[name]
  if (!Array.isArray(values)) return []
  return values.flatMap((item) => {
    if (typeof item === 'string') return [item]
    if (item && typeof item === 'object' && !Array.isArray(item) && typeof item.quote === 'string') return [item.quote]
    return []
  })
}

export default async function OperationalReportsPage({ searchParams }: { searchParams: Promise<{ report?: string }> }) {
  const user = await getCurrentUser()
  const orgId = getAppOrganizationId(user)
  const role = getAppRole(user)
  if (!orgId || (role !== 'org_admin' && role !== 'nurse')) redirect('/staff')
  if (!(await requireOrgFeature(OPERATIONAL_REPORT_ENGINE.moduleKey)).allowed) return <FeatureDisabledState />
  const header = <PageHeader title="Raporty operacyjne" back={{ href: '/staff/reports', label: 'Wróć do raportów' }} />
  const supabase = await createClient()
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assurance?.currentLevel !== 'aal2') {
    return <div className="space-y-4">{header}<FeatureFlagsMfa needsVerification={assurance?.nextLevel === 'aal2'}
      description="Potwierdź drugi składnik uwierzytelniania, aby sprawdzić raporty operacyjne." /></div>
  }

  const result = await supabase.from(OPERATIONAL_REPORT_ENGINE.reportResource)
    .select('id, status, requires_regeneration, period_start, period_end, organization_report_configs(category_label)')
    .eq('organization_id', orgId).order('period_end', { ascending: false }).limit(100)
  const { report } = await searchParams
  const selected = result.data?.find(({ id }) => id === report)
  const detail = selected && await supabase.from(OPERATIONAL_REPORT_ENGINE.reportResource)
    .select('content, status, requires_regeneration').eq('id', selected.id).eq('organization_id', orgId).maybeSingle()
  const raw = detail?.data?.content
  const content = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null

  return (
    <div className="space-y-6">
      {header}
      {detail?.error && <ListError title="Nie udało się odczytać raportu" />}
      {selected && content && (
        <section className="space-y-4 rounded-lg border border-border p-4" aria-label="Treść raportu">
          <h2 className="text-base font-semibold">{selected.organization_report_configs?.category_label}</h2>
          {typeof content.summary === 'string' && <p className="whitespace-pre-wrap text-sm">{content.summary}</p>}
          {Object.entries(sectionLabels).map(([name, label]) => {
            const values = sectionValues(content, name)
            return values.length > 0 && (
              <div key={name}>
                <h3 className="text-sm font-semibold">{label}</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {[...new Set(values)].map((value) => <li key={value}>{value}</li>)}
                </ul>
              </div>
            )
          })}
          {detail?.data?.status === 'DRAFT' && !detail.data.requires_regeneration && <ApproveOperationalReport reportId={selected.id} />}
        </section>
      )}
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Kategoria</TableHead><TableHead>Okres</TableHead><TableHead>Status</TableHead>
              <TableHead>Raport</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {result.error && <TableStateRow colSpan={4} state="error" title="Nie udało się pobrać raportów" />}
            {!result.error && !result.data?.length && <TableStateRow colSpan={4} state="empty" title="Brak raportów operacyjnych" />}
            {result.data?.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.organization_report_configs?.category_label}</TableCell>
                <TableCell>{time.format(new Date(row.period_start))} – {time.format(new Date(row.period_end))}</TableCell>
                <TableCell><StatusBadge tone={row.status === 'APPROVED' ? 'brand' : 'neutral'}>
                  {rowStatus(row.status, row.requires_regeneration)}
                </StatusBadge></TableCell>
                <TableCell><Link href={`?report=${row.id}`} prefetch={false}
                  className="inline-flex min-h-touch items-center px-2 font-medium underline">Otwórz raport</Link></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </div>
  )
}
