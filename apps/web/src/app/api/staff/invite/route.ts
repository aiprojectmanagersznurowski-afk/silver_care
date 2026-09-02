import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
    }

    const appRole = user.app_metadata?.role
    const orgId = user.app_metadata?.organization_id

    if (appRole !== 'org_admin' && appRole !== 'admin') {
      return NextResponse.json({ error: 'Brak uprawnień administratora' }, { status: 403 })
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Brak przypisania do organizacji' }, { status: 400 })
    }

    const body = await request.json()
    const { email, role } = body

    if (!email?.trim()) {
      return NextResponse.json({ error: 'Adres e-mail jest wymagany' }, { status: 400 })
    }

    if (role !== 'nurse' && role !== 'paramedic') {
      return NextResponse.json({ error: 'Nieprawidłowa rola' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const origin = request.headers.get('origin') || 'https://silver-care-six.vercel.app'
    
    // Inviting user through generating link directly, bypassing automatic supabase email
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email: email.trim(),
      options: {
        data: {
          role: role,
          organization_id: orgId
        },
        redirectTo: `${origin}/dashboard`
      }
    })

    if (error) {
      console.error(`Invite error:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Assign app_metadata to ensure security rules apply immediately
    if (data.user) {
      const { error: updateError } = await adminClient.auth.admin.updateUserById(data.user.id, {
        app_metadata: {
          role: role,
          organization_id: orgId
        }
      })

      if (updateError) {
        console.error(`Failed to update app_metadata:`, updateError)
        return NextResponse.json({ error: 'Zaproszono użytkownika, ale wystąpił błąd podczas nadawania uprawnień.' }, { status: 500 })
      }
    }

    const actionLink = data?.properties?.action_link
    const proxyUrl = actionLink ? `${origin}/accept-invite?url=${encodeURIComponent(actionLink)}` : null

    return NextResponse.json({ success: true, url: proxyUrl })
  } catch (error: any) {
    console.error('API error: An unexpected error occurred')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
