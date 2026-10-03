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
    const { title, time, type, resident_id, target_date, target_dates } = body

    if (!title || !time || !type) {
      return NextResponse.json({ error: 'Missing title, time, or type' }, { status: 400 })
    }

    const orgId = user.app_metadata?.organization_id

    if (!orgId) {
      return NextResponse.json({ error: 'Brak przypisania do organizacji' }, { status: 403 })
    }

    const lowerTitle = String(title).toLowerCase()
    const FORBIDDEN_SUBSTRINGS = ['pacj', 'zawa', 'udar']
    for (const term of FORBIDDEN_SUBSTRINGS) {
      if (lowerTitle.includes(term)) {
        return NextResponse.json(
          { error: 'Wpis narusza zasady opiekuńcze. Wpis musi mieć charakter organizacyjny i neutralny.' },
          { status: 400 }
        )
      }
    }

    let rowsToInsert: any[] = []

    if (Array.isArray(target_dates) && target_dates.length > 0) {
      rowsToInsert = target_dates.map(date => ({
        organization_id: orgId,
        title: title.trim(),
        time,
        type,
        resident_id: resident_id || null,
        target_date: date,
        is_template: false,
      }))
    } else {
      rowsToInsert = [{
        organization_id: orgId,
        title: title.trim(),
        time,
        type,
        resident_id: resident_id || null,
        target_date: target_date || null,
        is_template: !target_date,
      }]
    }

    const { error: insertError } = await supabase
      .from('agenda_items')
      .insert(rowsToInsert)

    if (insertError) {
      return NextResponse.json({ error: 'Failed to create agenda item' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appRole = user.app_metadata?.role
  if (!['nurse', 'paramedic', 'caregiver', 'org_admin', 'admin', 'super_admin'].includes(appRole)) {
    return NextResponse.json({ error: 'Brak uprawnień personelu' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { id, title, time, type, resident_id } = body

    if (!id || !title || !time || !type) {
      return NextResponse.json({ error: 'Brakujące wymagane pola (id, title, time, type)' }, { status: 400 })
    }

    const lowerTitle = String(title).toLowerCase()
    const FORBIDDEN_SUBSTRINGS = ['pacj', 'zawa', 'udar']
    for (const term of FORBIDDEN_SUBSTRINGS) {
      if (lowerTitle.includes(term)) {
        return NextResponse.json(
          { error: 'Wpis narusza zasady opiekuńcze. Wpis musi mieć charakter organizacyjny i neutralny.' },
          { status: 400 }
        )
      }
    }

    const orgId = user.app_metadata?.organization_id
    let updateQuery = supabase
      .from('agenda_items')
      .update({
        title: title.trim(),
        time,
        type,
        resident_id: resident_id || null,
      })
      .eq('id', id)

    if (orgId) {
      updateQuery = updateQuery.eq('organization_id', orgId)
    }

    const { error: updateError } = await updateQuery

    if (updateError) {
      return NextResponse.json({ error: 'Nie udało się zaktualizować wpisu' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Błąd serwera' }, { status: 500 })
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
