import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildPolarAuthUrl } from '@/lib/polar-client'

export const runtime = 'nodejs'

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url)
    const residentId = searchParams.get('residentId')

    if (!residentId) {
      return NextResponse.json({ error: 'Brak parametru residentId' }, { status: 400 })
    }

    // Pobierz dane pensjonariusza i upewnij się, że należy do organizacji
    const { data: resident, error: resError } = await supabase
      .from('residents')
      .select('id, organization_id, archived_at')
      .eq('id', residentId)
      .single()

    if (resError || !resident) {
      return NextResponse.json({ error: 'Nie znaleziono pensjonariusza' }, { status: 404 })
    }

    if (resident.archived_at) {
      return NextResponse.json({ error: 'Pensjonariusz jest zarchiwizowany' }, { status: 400 })
    }

    const authUrl = buildPolarAuthUrl(resident.id, resident.organization_id)

    // Jeśli zapytanie oczekuje JSON
    if (req.headers.get('accept')?.includes('application/json')) {
      return NextResponse.json({ url: authUrl })
    }

    // Przekierowanie do Polar Flow OAuth2
    return NextResponse.redirect(authUrl)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Nieoczekiwany błąd'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
