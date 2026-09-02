import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10)

  // Get today's items and templates
  const { data, error } = await supabase
    .from('agenda_items')
    .select('*')
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
    const { title, time, type, resident_id, is_template } = body

    if (!title || !time || !type) {
      return NextResponse.json({ error: 'Missing title, time, or type' }, { status: 400 })
    }

    const { error: insertError } = await supabase
      .from('agenda_items')
      .insert({
        title,
        time,
        type,
        resident_id: resident_id || null, // null = dotyczy wszystkich
        is_template: is_template || false,
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
