import { redirect } from 'next/navigation'
import { MFA_REQUIRED_ROLES } from '@silvercare/contracts/src/generated/roles'
import { FeatureFlagsMfa } from '@/components/admin/FeatureFlagsMfa'
import { PageHeader } from '@/components/patterns/PageHeader'
import { Button } from '@/components/ui/button'
import { getAppRole } from '@/lib/auth/app-role'
import { staffMfaSatisfied } from '@/lib/auth/staff-mfa'
import { createClient } from '@/lib/supabase/server'

const mfaRoles = new Set<string>(MFA_REQUIRED_ROLES)

function portalDestination(value: string | string[] | undefined) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/'
  const origin = 'https://silvercare.invalid'
  const url = new URL(value, origin)
  return url.origin === origin && /^\/(?:admin|staff|voice|reports)(?:\/|$)/.test(url.pathname)
    ? url.pathname + url.search
    : '/'
}

/** @REQ: SEC-MFA-STAFF */
export default async function StaffMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = getAppRole(user)
  if (!user || !role || !mfaRoles.has(role)) redirect('/')

  const { data } = await supabase.auth.getClaims()
  if (data?.claims.sub === user.id && await staffMfaSatisfied(supabase, data.claims.aal)) {
    redirect(portalDestination((await searchParams).returnTo))
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-4">
      <PageHeader title="Potwierdź logowanie" />
      <FeatureFlagsMfa
        needsVerification={user.factors?.some((factor) => factor.status === 'verified') ?? false}
        description="Potwierdź drugi składnik, aby przejść do panelu."
      />
      <form method="post" action="/auth/signout">
        <Button type="submit" variant="outline" className="min-h-touch">Wyloguj się</Button>
      </form>
    </main>
  )
}
