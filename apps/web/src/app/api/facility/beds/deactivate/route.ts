import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { bed_id, is_active } = body

    if (!bed_id || typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'Brak wymaganych danych (bed_id, is_active)' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('beds')
      .update({ is_active })
      .eq('id', bed_id)

    if (updateError) {
      console.error('Failed to update bed status:', updateError)
      // Check for trigger error when deactivating active bed
      if (updateError.message?.includes('Cannot deactivate a bed that has an active assignment')) {
        return NextResponse.json({ error: 'Nie można dezaktywować łóżka z przypisanym pensjonariuszem' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Błąd podczas zmiany statusu łóżka: ' + updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Wystąpił nieoczekiwany błąd serwera' }, { status: 500 })
  }
}
