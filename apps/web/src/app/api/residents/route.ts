import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHmac } from 'crypto'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('residents')
      .select('id, first_name, last_name, pesel_hash')
      .order('last_name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ residents: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
    }

    const body = await request.json()
    const { first_name, last_name, pesel, avatar_url } = body

    if (!first_name?.trim() || !last_name?.trim() || !pesel?.trim()) {
      return NextResponse.json({ error: 'Imię, nazwisko i PESEL są wymagane' }, { status: 400 })
    }

    // Validation
    if (pesel.trim().length !== 11 || !/^\d+$/.test(pesel.trim())) {
      return NextResponse.json({ error: 'PESEL musi składać się z 11 cyfr.' }, { status: 400 })
    }

    // PESEL Hashing
    const salt = process.env.PESEL_HASH_SALT
    if (!salt) {
      console.error('Missing PESEL_HASH_SALT in environment variables')
      return NextResponse.json({ error: 'Błąd konfiguracji serwera' }, { status: 500 })
    }
    
    const peselHash = createHmac('sha256', salt)
      .update(pesel.trim())
      .digest('hex')

    // Debug: log role info (no PII, only role identifiers)
    const appRole = user.app_metadata?.role
    const userRole = user.user_metadata?.role || user.app_metadata?.role
    const orgId = user.app_metadata?.organization_id
    console.log(`DEBUG insert: app_role=${appRole}, user_role=${userRole}, org_id=${orgId}`)

    const { data, error } = await supabase
      .from('residents')
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        pesel_hash: peselHash,
        avatar_url: avatar_url || null
      })
      .select('id')
      .single()

    if (error) {
      console.error(`Insert error: code=${error.code}, hint=${error.hint}`)
      return NextResponse.json({ 
        error: `Błąd: ${error.code} — ${error.message}`,
        hint: error.hint,
        details: error.details
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (error: any) {
    console.error('API error: An unexpected error occurred')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
