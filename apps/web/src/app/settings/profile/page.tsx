import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getProfileSecurityData } from '@/actions/profile'
import { redirect } from 'next/navigation'
import { ProfileSecurityClient } from './profile-client'

export const metadata: Metadata = {
  title: 'Ustawienia Profilu i Bezpieczeństwa | Silver Care',
  description: 'Zarządzaj swoim profilem, hasłem, sesjami i zabezpieczeniami konta.',
}

function resolveDashboardHref(role?: string) {
  if (role === 'super_admin' || role === 'org_admin' || role === 'admin') {
    return '/admin'
  }
  if (role === 'nurse' || role === 'caregiver' || role === 'paramedic') {
    return '/staff'
  }
  return '/dashboard'
}

export default async function ProfileSettingsPage() {
  const data = await getProfileSecurityData()

  if (!data) {
    redirect('/login')
  }

  const backHref = resolveDashboardHref(data.user.role)

  return (
    <div className="min-h-screen bg-muted py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Wróć do panelu</span>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Profil i Bezpieczeństwo Konta
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Zarządzaj swoimi danymi uwierzytelniającymi, aktywnymi sesjami i poziomem zabezpieczeń.
          </p>
        </div>

        <ProfileSecurityClient initialData={data} />
      </div>
    </div>
  )
}
