import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RootRedirector } from './RootRedirector'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const role = user.user_metadata?.role || user.app_metadata?.role
    if (role === 'family') redirect('/dashboard')
    if (role === 'nurse' || role === 'paramedic') redirect('/staff')
    if (role === 'admin' || role === 'org_admin' || role === 'facility_manager') redirect('/admin')
  }

  // Not logged in -> show a simple welcome / redirect to login
  return <RootRedirector />
}
