import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
    }

    const body = await request.json()
    const { first_name, last_name } = body

    if (!first_name?.trim() || !last_name?.trim()) {
      return NextResponse.json({ error: 'Imię i nazwisko są wymagane' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('residents')
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('Insert error: Database insert failed')
      return NextResponse.json({ error: 'Błąd podczas dodawania pensjonariusza' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (error: any) {
    console.error('API error: An unexpected error occurred')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
