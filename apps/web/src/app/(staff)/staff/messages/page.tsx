import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function StaffMessagesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ residentId?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const role = user.app_metadata?.role
  if (role === 'org_admin' || role === 'admin') {
    const params = await searchParams
    const suffix = params?.residentId ? `?residentId=${encodeURIComponent(params.residentId)}` : ''
    redirect(`/admin/messages${suffix}`)
  }

  redirect('/unauthorized')
}
