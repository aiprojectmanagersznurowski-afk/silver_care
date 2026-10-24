import { Metadata } from 'next'
import { getProfileSecurityData } from '@/actions/profile'
import { redirect } from 'next/navigation'
import { ProfileSecurityClient } from './profile-client'
import { PageHeader } from '@/components/patterns/PageHeader'

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
        <PageHeader
          back={{ href: backHref, label: 'Wróć do panelu' }}
          title="Profil i Bezpieczeństwo Konta"
          description="Zarządzaj swoimi danymi uwierzytelniającymi, aktywnymi sesjami i poziomem zabezpieczeń."
        />

        <ProfileSecurityClient initialData={data} />
      </div>
    </div>
  )
}
