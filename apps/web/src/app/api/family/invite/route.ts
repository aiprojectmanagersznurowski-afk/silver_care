import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limiter'
import { renderFamilyInviteEmail } from '@/lib/notification-templates'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined
    const supabase = await createClient(token)
    let user = null
    if (token) {
      const { data: authData } = await supabase.auth.getUser(token)
      user = authData?.user || null
    }
    if (!user) {
      const { data: cookieAuthData } = await supabase.auth.getUser()
      user = cookieAuthData?.user || null
    }
    
    if (!user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1'
    const rateCheck = checkRateLimit(`invite:${user.id || ip}`, 15, 60000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Przekroczono limit wysyłki zaproszeń (max 15/min)' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) } }
      )
    }

    const appRole = user.app_metadata?.role
    let orgId = user.app_metadata?.organization_id

    if (appRole !== 'org_admin' && appRole !== 'admin' && appRole !== 'super_admin') {
      return NextResponse.json({ error: 'Brak uprawnień administratora' }, { status: 403 })
    }

    const body = await request.json()
    const { email, phone, resident_id, role } = body

    if (!email?.trim() || !resident_id) {
      return NextResponse.json({ error: 'Adres e-mail i ID pensjonariusza są wymagane' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    if (!orgId) {
      const { data: resident } = await adminClient
        .from('residents')
        .select('organization_id')
        .eq('id', resident_id)
        .maybeSingle()
      orgId = resident?.organization_id
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Brak przypisania do organizacji' }, { status: 400 })
    }

    const assignedRole = role === 'legal_guardian' ? 'legal_guardian' : 'family'

    // Create invitation record (bypassing RLS for simplicity, but we still inject orgId)
    const { data, error } = await adminClient
      .from('resident_invitations')
      .insert({
        organization_id: orgId,
        resident_id: resident_id,
        role: assignedRole,
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
      console.log(`[EMAIL] Wysyłanie zaproszenia...`)

      // Pobierz nazwę placówki
      let orgName: string | undefined
      if (orgId) {
        const { data: org } = await adminClient
          .from('organizations')
          .select('name')
          .eq('id', orgId)
          .maybeSingle()
        if (org?.name) orgName = org.name
      }

      const emailTemplate = renderFamilyInviteEmail({ inviteUrl: registerUrl, organizationName: orgName })
      
      const emailRes = await fetch('https://send.api.mailtrap.io/api/send', {
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

      if (!emailRes.ok) {
        const errorData = await emailRes.text()
        console.error('Błąd Mailtrap API:', errorData)
      } else {
        console.log(`[EMAIL] Zaproszenie wysłane pomyślnie.`)
      }
    } else {
      console.log(`[MOCK EMAIL] Brak EMAIL_PROVIDER_KEY. Link: ${registerUrl}`)
    }

    return NextResponse.json({ success: true, url: registerUrl, id: data.id }) // Returning url and id for testing purposes
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
