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
    const { email, resident_id } = body

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
        email: email.trim()
      })
      .select('id')
      .single()

    if (error) {
      console.error(`Invite insertion error:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Mock sending email
    const reqUrl = new URL(request.url)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${reqUrl.protocol}//${reqUrl.host}`
    const registerUrl = `${baseUrl}/register?token=${data.id}`
    console.log(`[MOCK EMAIL] Wysyłanie e-maila z linkiem do rejestracji: ${registerUrl}`)

    return NextResponse.json({ success: true, url: registerUrl }) // Returning url for testing purposes
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
