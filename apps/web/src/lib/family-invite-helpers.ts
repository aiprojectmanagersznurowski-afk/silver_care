import { createClient } from '@/lib/supabase/server'
import { renderFamilyInviteEmail } from '@/lib/notification-templates'

export async function getAuthUserFromRequest(request: Request) {
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
  return { user, supabase }
}

export function getBaseUrlFromRequest(request: Request): string {
  const host = request.headers.get('host') || 'localhost:3000'
  const protocol = request.headers.get('x-forwarded-proto') || 'http'
  return process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`
}

export async function sendFamilyInviteEmail({
  email,
  orgId,
  registerUrl,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient
}: {
  email: string
  orgId: string | null | undefined
  registerUrl: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any
}): Promise<boolean> {
  if (!process.env.EMAIL_PROVIDER_KEY || !email) {
    return false
  }

  let orgName: string | undefined
  if (orgId) {
    const { data: org } = await adminClient
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .maybeSingle()
    if (org?.name) orgName = org.name
  }

  const emailTemplate = renderFamilyInviteEmail({
    inviteUrl: registerUrl,
    organizationName: orgName
  })

  try {
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
      return false
    }

    return true
  } catch (err) {
    console.error('Błąd wysyłki e-maila:', err)
    return false
  }
}
