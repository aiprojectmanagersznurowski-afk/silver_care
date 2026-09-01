import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
    const { email, phone, resident_id } = body

    if (!email?.trim() || !resident_id) {
      return NextResponse.json({ error: 'Adres e-mail i ID pensjonariusza są wymagane' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Create invitation record (bypassing RLS for simplicity, but we still inject orgId)
    const { data, error } = await adminClient
      .from('resident_invitations')
      .insert({
        organization_id: orgId,
        resident_id: resident_id,
        role: 'family',
        email: email.trim(),
        phone: phone?.trim() || null
      })
      .select('id')
      .single()

    if (error) {
      console.error(`Invite insertion error:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Send invitation email via Mailtrap
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`
    const registerUrl = `${baseUrl}/register?token=${data.id}`
    
    if (process.env.EMAIL_PROVIDER_KEY) {
      console.log(`[EMAIL] Wysyłanie zaproszenia do ${email.trim()}...`)
      
      const emailRes = await fetch('https://send.api.mailtrap.io/api/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EMAIL_PROVIDER_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: [{ email: email.trim() }],
          from: { email: 'hello@demomailtrap.com', name: 'Silver Care' },
          subject: 'Zaproszenie do portalu rodziny Silver Care',
          text: `Zostałeś zaproszony do portalu rodziny Silver Care. Kliknij w poniższy link, aby utworzyć konto i śledzić postępy Twojego bliskiego:\n\n${registerUrl}\n\nTen link jest jednorazowy i ważny przez 7 dni.`
        })
      })

      if (!emailRes.ok) {
        const errorData = await emailRes.text()
        console.error('Błąd Mailtrap API:', errorData)
      } else {
        console.log(`[EMAIL] Zaproszenie wysłane pomyślnie.`)
      }
    } else {
      console.log(`[MOCK EMAIL] Brak EMAIL_PROVIDER_KEY. Link: ${registerUrl}`)
    }

    return NextResponse.json({ success: true, url: registerUrl }) // Returning url for testing purposes
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
