import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const eventPayload = await req.json().catch(() => ({}))
    const supabase = await createClient()

    // 1. Zarejestruj ping webhooka w audit_logs (bez danych osobowych)
    const externalUserId = eventPayload['user-id'] || eventPayload.userId || eventPayload['user_id']
    const eventType = eventPayload.event || eventPayload['event_type'] || 'PING'

    if (externalUserId) {
      // Znajdź powiązanie pensjonariusza
      const { data: link } = await supabase
        .from('external_wearable_links')
        .select('id, organization_id, resident_id')
        .eq('provider', 'POLAR')
        .eq('external_user_id', String(externalUserId))
        .maybeSingle()

      if (link) {
        await supabase.from('audit_logs').insert({
          organization_id: link.organization_id,
          resident_id: link.resident_id,
          action: 'WEARABLE_WEBHOOK_PING',
          payload: {
            provider: 'POLAR',
            event_type: eventType,
            received_at: new Date().toISOString()
          }
        })
      }
    }

    // Polar wymaga natychmiastowej odpowiedzi 200 OK
    return NextResponse.json({ received: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Nieoczekiwany błąd'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
