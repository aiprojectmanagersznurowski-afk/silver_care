import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { assertTargetOrgFeatureForApi } from '@/lib/feature-flags'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function validPolarSignature(req: Request, body: Buffer) {
  const secret = process.env.POLAR_WEBHOOK_SIGNATURE_SECRET
  const signature = req.headers.get('Polar-Webhook-Signature')
  if (!secret || !signature || !/^[0-9a-f]{64}$/i.test(signature)) return false
  return timingSafeEqual(Buffer.from(signature, 'hex'), createHmac('sha256', secret).update(body).digest())
}

export async function POST(req: Request) {
  try {
    const body = Buffer.from(await req.arrayBuffer())
    let payload: Record<string, unknown> | null
    try {
      payload = JSON.parse(body.toString('utf8'))
    } catch {
      return NextResponse.json({ error: 'Nieprawidłowe zdarzenie Polar' }, { status: 400 })
    }
    const externalUserId = payload?.['user-id'] ?? payload?.userId ?? payload?.user_id
    const eventType = payload?.event ?? payload?.event_type

    // Polar sends PING when registering the endpoint, before it returns the signing key.
    if (eventType === 'PING' && externalUserId == null) return NextResponse.json({ received: true })
    if (!validPolarSignature(req, body)) {
      return NextResponse.json({ error: 'Nieprawidłowy podpis zdarzenia Polar' }, { status: 401 })
    }
    if (!['number', 'string'].includes(typeof externalUserId) || typeof eventType !== 'string') {
      return NextResponse.json({ error: 'Nieprawidłowe zdarzenie Polar' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: link, error } = await supabase.from('external_wearable_links')
      .select('organization_id, resident_id')
      .eq('provider', 'POLAR').eq('external_user_id', String(externalUserId)).maybeSingle()

    if (error) return NextResponse.json({ error: 'Nie udało się odczytać powiązania Polar' }, { status: 500 })
    if (link) {
      const featureDenied = await assertTargetOrgFeatureForApi(supabase, link.organization_id, '/api/polar/webhook')
      if (featureDenied) return featureDenied

      const { error: auditError } = await supabase.from('audit_logs').insert({
        organization_id: link.organization_id,
        resident_id: link.resident_id,
        action: 'WEARABLE_WEBHOOK_PING',
        payload: { provider: 'POLAR', event_type: eventType, received_at: new Date().toISOString() },
      })
      if (auditError) return NextResponse.json({ error: 'Nie udało się zapisać zdarzenia Polar' }, { status: 500 })
    }

    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ error: 'Błąd przetwarzania zdarzenia Polar' }, { status: 500 })
  }
}
