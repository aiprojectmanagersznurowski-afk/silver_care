import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { renderStaffInviteEmail } from '@/lib/notification-templates'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
    }

    const appRole = user.app_metadata?.role
    let orgId = user.app_metadata?.organization_id

    if (appRole !== 'org_admin' && appRole !== 'admin' && appRole !== 'super_admin') {
      return NextResponse.json({ error: 'Brak uprawnień administratora' }, { status: 403 })
    }

    if (!orgId && appRole === 'super_admin') {
      const adminClient = createAdminClient()
      const { data: org } = await adminClient.from('organizations').select('id').limit(1).maybeSingle()
      orgId = org?.id
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

    if (proxyUrl && process.env.EMAIL_PROVIDER_KEY) {
      try {
        let orgName: string | undefined
        if (orgId) {
          const { data: org } = await adminClient
            .from('organizations')
            .select('name')
            .eq('id', orgId)
            .maybeSingle()
          if (org?.name) orgName = org.name
        }

        const roleDisplay = role === 'nurse' ? 'Pielęgniarka' : role === 'paramedic' ? 'Ratownik medyczny' : 'Personel'
        const emailTemplate = renderStaffInviteEmail({
          inviteUrl: proxyUrl,
          organizationName: orgName,
          roleName: roleDisplay,
        })

        await fetch('https://send.api.mailtrap.io/api/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.EMAIL_PROVIDER_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: [{ email: email.trim() }],
            from: { email: 'noreply@silvercare.space', name: 'Silver Care' },
            subject: emailTemplate.subject,
            text: emailTemplate.text,
            html: emailTemplate.html,
          })
        })
      } catch (mailErr) {
        console.error('Błąd wysyłki e-maila zaproszenia pracownika:', mailErr)
      }
    }

    return NextResponse.json({ success: true, url: proxyUrl })
  } catch (error: any) {
    console.error('API error: An unexpected error occurred')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
