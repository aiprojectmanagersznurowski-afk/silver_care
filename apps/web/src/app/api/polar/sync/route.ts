import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  fetchPolarDailyActivity, 
  fetchPolarSleep, 
  normalizePolarActivity, 
  normalizePolarSleep 
} from '@/lib/polar-client'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { residentId, date: targetDate } = body

    if (!residentId) {
      return NextResponse.json({ error: 'Brak residentId' }, { status: 400 })
    }

    const dateStr = targetDate || new Date().toISOString().split('T')[0]

    // 1. Pobierz powiązanie urządzenia
    const { data: link, error: linkErr } = await supabase
      .from('external_wearable_links')
      .select('id, organization_id, external_user_id')
      .eq('resident_id', residentId)
      .eq('provider', 'POLAR')
      .single()

    if (linkErr || !link) {
      return NextResponse.json({ error: 'Pensjonariusz nie ma aktywnego powiązania z opaską Polar' }, { status: 404 })
    }

    // 2. Pobierz token autoryzacyjny
    const { data: tokenRecord, error: tokenErr } = await supabase
      .from('polar_oauth_tokens')
      .select('access_token')
      .eq('link_id', link.id)
      .single()

    if (tokenErr || !tokenRecord?.access_token) {
      return NextResponse.json({ error: 'Brak aktywnego tokenu dostępowego dla opaski' }, { status: 404 })
    }

    // 3. Pobierz aktywność i sen z chmury Polar
    const [activityRaw, sleepRaw] = await Promise.all([
      fetchPolarDailyActivity(tokenRecord.access_token, dateStr),
      fetchPolarSleep(tokenRecord.access_token, dateStr)
    ])

    let payloads: Array<{ metric: string; raw_value: string; dedup_id: string }> = []

    if (activityRaw) {
      const actNormalized = normalizePolarActivity(activityRaw, dateStr)
      payloads = [...payloads, ...actNormalized]
    }

    if (sleepRaw) {
      const sleepNormalized = normalizePolarSleep(sleepRaw)
      payloads = [...payloads, ...sleepNormalized]
    }

    if (payloads.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Brak nowych danych telemetrycznych z opaski na dzień ' + dateStr,
        inserted: 0 
      })
    }

    // 4. Ingest wsadowy z deduplikacją i weryfikacją zgody (INT-INGEST-PRECONDITIONS, INT-NORMALIZATION)
    const { data: ingestResult, error: ingestError } = await supabase.rpc('process_ingest_batch', {
      p_org_id: link.organization_id,
      p_res_id: residentId,
      p_provider: 'POLAR',
      p_payloads: payloads
    })

    if (ingestError) {
      return NextResponse.json({ error: 'Błąd przetwarzania wsadu telemetrycznego: ' + ingestError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      date: dateStr,
      metricsCount: payloads.length,
      result: ingestResult
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Nieoczekiwany błąd'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
