import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { bed_id, resident_id } = body

    if (!bed_id || !resident_id) {
      return NextResponse.json({ error: 'Brak wymaganych danych (bed_id, resident_id)' }, { status: 400 })
    }

    // 1. Sprawdź czy pensjonariusz ma już aktywne przypisanie
    const { data: activeAssignments, error: checkError } = await supabase
      .from('bed_assignments')
      .select('id, bed_id')
      .eq('resident_id', resident_id)
      .is('unassigned_at', null)

    if (checkError) {
      return NextResponse.json({ error: 'Błąd podczas weryfikacji przypisania pensjonariusza' }, { status: 500 })
    }

    if (activeAssignments && activeAssignments.length > 0) {
      const currentBedId = activeAssignments[0].bed_id
      if (currentBedId === bed_id) {
        return NextResponse.json({ error: 'Pensjonariusz jest już przypisany do tego łóżka' }, { status: 400 })
      }
      
      // Transfer do nowego łóżka
      const { error: transferError } = await supabase.rpc('transfer_resident_bed', {
        p_resident_id: resident_id,
        p_new_bed_id: bed_id
      })

      if (transferError) {
        console.error('Failed to transfer bed assignment:', transferError)
        return NextResponse.json({ error: 'Błąd podczas przenoszenia pensjonariusza: ' + transferError.message }, { status: 500 })
      }
    } else {
      // Nowe przypisanie
      const { error: assignError } = await supabase
        .from('bed_assignments')
        .insert({
          bed_id,
          resident_id
        })

      if (assignError) {
        console.error('Failed to assign bed:', assignError)
        return NextResponse.json({ error: 'Błąd podczas przypisywania pensjonariusza: ' + assignError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Wystąpił nieoczekiwany błąd serwera' }, { status: 500 })
  }
}
