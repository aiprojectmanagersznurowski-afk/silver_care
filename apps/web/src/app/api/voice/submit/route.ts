import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

    const role = user.app_metadata?.role
    if (role !== 'nurse' && role !== 'org_admin' && role !== 'super_admin' && role !== 'admin') {
      return NextResponse.json({ error: 'Tylko personel może przesyłać nagrania' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const residentId = body.resident_id
    const clientUuid = body.client_uuid || null
    const audioUrl = body.audio_url || 'local-pending-storage'

    if (!residentId) {
      return NextResponse.json({ error: 'Brak identyfikatora pensjonariusza' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 1. Sprawdzamy czy istnieje już wpis dla client_uuid (idempotencja VOICE-OFFLINE)
    if (clientUuid) {
      const { data: existing } = await adminClient
        .from('voice_draft_notes')
        .select('id, async_status')
        .eq('client_uuid', clientUuid)
        .single()

      if (existing) {
        return NextResponse.json(
          {
            success: true,
            draftId: existing.id,
            status: existing.async_status,
            message: 'Zadanie zostało już wcześniej zarejestrowane (idempotency)',
          },
          { status: 202 }
        )
      }
    }

    // 2. Utworzenie nowego draftu ze statusem kolejki QUEUED
    const { data: newDraft, error: insertErr } = await adminClient
      .from('voice_draft_notes')
      .insert({
        resident_id: residentId,
        nurse_id: user.id,
        audio_url: audioUrl,
        client_uuid: clientUuid,
        status: 'DRAFT',
        async_status: 'QUEUED',
      })
      .select('id, async_status')
      .single()

    if (insertErr || !newDraft) {
      return NextResponse.json(
        { error: 'Błąd tworzenia zadania przetwarzania notatki: ' + (insertErr?.message || '') },
        { status: 500 }
      )
    }

    // 3. Natychmiastowa odpowiedź HTTP 202 (<1.5s) zwalniająca interfejs personelu
    return NextResponse.json(
      {
        success: true,
        draftId: newDraft.id,
        status: newDraft.async_status,
        message: 'Nagranie przyjęte do asynchronicznego przetworzenia w tle',
      },
      { status: 202 }
    )
  } catch (error: any) {
    console.error('Submit voice job error:', error?.message || error)
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }
}
