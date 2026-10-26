import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RootRedirector } from './RootRedirector'
import { getAppRole } from '@/lib/auth/app-role'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const role = getAppRole(user)
    if (role === 'family' || role === 'legal_guardian') redirect('/dashboard')
    if (role === 'nurse') redirect('/staff')
    if (role === 'org_admin' || role === 'super_admin') redirect('/admin')
  }

  // Not logged in -> show a simple welcome / redirect to login
  return <RootRedirector />
}
