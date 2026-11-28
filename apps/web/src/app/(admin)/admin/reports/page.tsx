import { redirect } from 'next/navigation'
import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { OPERATIONAL_REPORT_ENGINE, VOICE_RETENTION } from '@silvercare/contracts/src/generated/voice'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FeatureDisabledState } from '@/components/patterns/FeatureDisabledState'
import { ListEmpty, ListError } from '@/components/patterns/ListState'
import { PageHeader } from '@/components/patterns/PageHeader'
import { OrganizationReportConfigsPanel } from '@/components/reports/OrganizationReportConfigsPanel'
import { withAuth } from '@/lib/api-auth'
import { getAppOrganizationId, getAppRole } from '@/lib/auth/app-role'
import { staffMfaSatisfied } from '@/lib/auth/staff-mfa'
import { getCurrentFeatureFlags, isOrgFeatureEnabled } from '@/lib/feature-flags'
import { getActiveImpersonation, safeGetCookieStore } from '@/lib/impersonation-guards'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { createClient } from '@/lib/supabase/server'

const { minDays, ttlDays, maxDays } = VOICE_RETENTION
const reportsPath = '/admin/reports'

async function saveVoiceRetention(organizationId: string, formData: FormData) {
  'use server'

  const save = withAuth(async (_request, { user, supabase }) => {
    if ((user.role === 'org_admin' && user.organizationId !== organizationId)
      || !await isOrgFeatureEnabled(supabase, organizationId, OPERATIONAL_REPORT_ENGINE.moduleKey)) {
      return new NextResponse(null, { status: 403 })
    }

    const submitted = formData.get('retentionDays')
    const days = typeof submitted === 'string' ? Number(submitted) : NaN
    if (!Number.isInteger(days) || days < minDays || days > maxDays) {
      return new NextResponse(null, { status: 422 })
    }

    const { error } = await supabase.rpc('set_voice_capture_retention', {
      p_organization_id: organizationId,
      p_days: days,
    })
    return new NextResponse(null, { status: error ? 500 : 204 })
  }, { roles: VOICE_RETENTION.setBy.map((role) => role.split(':')[0]), blockImpersonation: true })

  // The wrapper uses the current Server Action's cookies for authentication.
  const request = new NextRequest(new URL(reportsPath, 'http://localhost'), { method: 'POST' })
  const response = await save(request, { params: Promise.resolve({}) })
  const voiceRetention = response.ok ? 'saved' : response.status === 422 ? 'invalid' : 'error'
  redirect(`${reportsPath}?${new URLSearchParams({ organizationId, voiceRetention })}`)
}

async function VoiceRetentionCard({ organizationId, user }: { organizationId: string; user: User }) {
  const supabase = await createClient()
  const { data: auth, error: authError } = await supabase.auth.getClaims()
  const metadata = { app_metadata: auth?.claims.app_metadata ?? {} }
  const role = getAppRole(user)
  if (authError || !auth || auth.claims.sub !== user.id || getAppRole(metadata) !== role
    || (role === 'org_admin' && (getAppOrganizationId(user) !== organizationId
      || getAppOrganizationId(metadata) !== organizationId))
    || !await staffMfaSatisfied(supabase, auth.claims.aal)) return <ListError />

  const { data: setting, error } = await supabase.from('voice_retention_settings').select('retention_days')
    .eq('organization_id', organizationId).maybeSingle()
  if (error) return <ListError />

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle><h2>Retencja nagrań</h2></CardTitle>
        <CardDescription id="voice-retention-limits">
          Domyślny okres to {ttlDays} dni. Maksymalny okres to {maxDays} dni.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={saveVoiceRetention.bind(null, organizationId)} className="space-y-3">
          <div className="grid max-w-xs gap-1">
            <label htmlFor="voice-retention-days" className="text-sm font-medium">
              Okres przechowywania nagrań w dniach
            </label>
            <Input id="voice-retention-days" name="retentionDays" type="number" required step={1}
              min={minDays} max={maxDays} defaultValue={setting?.retention_days ?? ttlDays}
              aria-describedby="voice-retention-limits" />
          </div>
          <Button type="submit" className="min-h-touch min-w-touch">Zapisz retencję nagrań</Button>
        </form>
      </CardContent>
    </Card>
  )
}

function VoiceRetentionFeedback({ result }: { result?: string }) {
  if (result === 'saved') return <p role="status" className="text-sm">Zapisano retencję nagrań.</p>
  if (result === 'invalid') {
    return <p role="alert" className="text-sm text-destructive">Podaj pełną liczbę dni od {minDays} do {maxDays}.</p>
  }
  if (result === 'error') {
    return <p role="alert" className="text-sm text-destructive">Nie udało się zapisać retencji nagrań.</p>
  }
  return null
}

export default async function AdminReportsPage({ searchParams }: {
  searchParams: Promise<{ organizationId?: string; voiceRetention?: string }>
}) {
  const user = await getCurrentUser()
  const role = getAppRole(user)
  if (!user || (role !== 'super_admin' && role !== 'org_admin')) redirect('/')

  const { organizationId, voiceRetention } = await searchParams
  const isPlatformAdmin = role === 'super_admin' && !getActiveImpersonation(await safeGetCookieStore(), user)
  let panel
  if (isPlatformAdmin) {
    const supabase = await createClient()
    const { data: organizations, error } = await supabase.from('organizations').select('id, name').order('name')
    const selected = organizations?.find((org) => org.id === organizationId) ?? organizations?.[0]
    panel = error ? <ListError /> : selected ? (
      <>
        <form className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1">
            Placówka
            <select name="organizationId" defaultValue={selected.id} className="min-h-touch rounded-md border bg-background px-3">
              {organizations?.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
          </label>
          <Button type="submit" variant="outline">Pokaż ustawienia</Button>
        </form>
        {await isOrgFeatureEnabled(supabase, selected.id, OPERATIONAL_REPORT_ENGINE.moduleKey)
          ? <>
            <VoiceRetentionCard key={`voice-retention-${selected.id}`} organizationId={selected.id} user={user} />
            <OrganizationReportConfigsPanel key={selected.id} organizationId={selected.id} editMode="platform" />
          </>
          : <FeatureDisabledState />}
      </>
    ) : <ListEmpty title="Brak placówek" />
  } else {
    const context = await getCurrentFeatureFlags()
    panel = !context?.flags[OPERATIONAL_REPORT_ENGINE.moduleKey] ? <FeatureDisabledState />
      : role === 'super_admin' || user.app_metadata?.impersonator_id
        ? <ListEmpty title="Tryb podglądu" description="Konfiguracja kategorii jest dostępna po zakończeniu podglądu." />
        : <>
          <VoiceRetentionCard organizationId={context.organizationId} user={user} />
          <OrganizationReportConfigsPanel organizationId={context.organizationId}
            editMode={context.flags[OPERATIONAL_REPORT_ENGINE.delegationFlagKey] ? 'delegated' : 'read-only'} />
        </>
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Konfiguracja raportów operacyjnych" />
      <VoiceRetentionFeedback result={voiceRetention} />
      {panel}
    </div>
  )
}
