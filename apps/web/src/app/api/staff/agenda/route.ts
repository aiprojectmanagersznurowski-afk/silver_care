import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10)

  // Get items for the requested date, or recurring items (target_date is null)
  const { data, error } = await supabase
    .from('agenda_items')
    .select('*')
    .or(`target_date.eq.${dateStr},target_date.is.null`)
    .order('time', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch agenda' }, { status: 500 })
  }

  return NextResponse.json({ items: data }, { status: 200 })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { title, time, type, resident_id, target_date } = body

    if (!title || !time || !type) {
      return NextResponse.json({ error: 'Missing title, time, or type' }, { status: 400 })
    }

    const orgId = user.app_metadata?.organization_id

    if (!orgId) {
      return NextResponse.json({ error: 'Brak przypisania do organizacji' }, { status: 403 })
    }

    const { error: insertError } = await supabase
      .from('agenda_items')
      .insert({
        organization_id: orgId,
        title,
        time,
        type,
        resident_id: resident_id || null, // null = dotyczy wszystkich
        target_date: target_date || null, // null = wszystkie dni
        is_template: !target_date, // Zachowujemy dla kompatybilności wstecznej jeśli trzeba
      })

    if (insertError) {
      return NextResponse.json({ error: 'Failed to create agenda item' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const { error } = await supabase.from('agenda_items').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
