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
    const { email, role, avatar_url } = body

    if (!email?.trim()) {
      return NextResponse.json({ error: 'Adres e-mail jest wymagany' }, { status: 400 })
    }

    if (role !== 'nurse' && role !== 'paramedic') {
      return NextResponse.json({ error: 'Nieprawidłowa rola' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const origin = request.headers.get('origin') || 'https://silver-care-six.vercel.app'
    
    // Tworzymy użytkownika od razu z odpowiednimi metadanymi, aby nie używać updateUserById, 
    // które unieważnia wygenerowany token zaproszenia.
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      email_confirm: false,
      app_metadata: {
        role: role,
        organization_id: orgId
      },
      user_metadata: {
        role: role,
        organization_id: orgId,
        avatar_url: avatar_url || null
      }
    })

    if (createError) {
      // Jeśli użytkownik już istnieje, spróbujmy mimo to wygenerować link 
      // (Supabase na to pozwala dla unconfirmed users lub wyśle magic link)
      if (createError.code !== 'user_already_exists') {
        console.error(`Create user error:`, createError)
        return NextResponse.json({ error: 'Nie udało się utworzyć konta: ' + createError.message }, { status: 500 })
      }
    }

    // Generujemy link bez wysyłania e-maila
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email: email.trim(),
      options: {
        redirectTo: `${origin}/login`
      }
    })

    if (error) {
      console.error(`Invite error:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const actionLink = data?.properties?.action_link
    const proxyUrl = actionLink ? `${origin}/accept-invite?url=${encodeURIComponent(actionLink)}` : null

    return NextResponse.json({ success: true, url: proxyUrl })
  } catch (error: any) {
    console.error('API error: An unexpected error occurred')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
