import { Metadata } from 'next'
import { getProfileSecurityData } from '@/actions/profile'
import { redirect } from 'next/navigation'
import { ProfileSecurityClient } from './profile-client'

export const metadata: Metadata = {
  title: 'Ustawienia Profilu i Bezpieczeństwa | Silver Care',
  description: 'Zarządzaj swoim profilem, hasłem, sesjami i zabezpieczeniami konta.',
}

export default async function ProfileSettingsPage() {
  const data = await getProfileSecurityData()

  if (!data) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Profil i Bezpieczeństwo Konta
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Zarządzaj swoimi danymi uwierzytelniającymi, aktywnymi sesjami i poziomem zabezpieczeń.
          </p>
        </div>

        <ProfileSecurityClient initialData={data} />
      </div>
    </div>
  )
}
