import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
    }

    const role = user.app_metadata?.role as string | undefined
    if (!['org_admin', 'super_admin', 'admin'].includes(role || '')) {
      return NextResponse.json({ error: 'Brak uprawnień administratora placówki' }, { status: 403 })
    }

    const orgId = user.app_metadata?.organization_id as string | undefined
    const body = await request.json()
    const { bed_id, resident_id, reason } = body

    if (!bed_id || !resident_id) {
      return NextResponse.json({ error: 'Brak wymaganych danych (bed_id, resident_id)' }, { status: 400 })
    }

    // Weryfikacja izolacji placówki (cross-tenant check)
    const { data: residentData } = await supabase
      .from('residents')
      .select('id, organization_id')
      .eq('id', resident_id)
      .single()
    if (!residentData || residentData.organization_id !== orgId) {
      return NextResponse.json({ error: 'Podopieczny nie należy do Twojej placówki' }, { status: 403 })
    }

    const { data: bedData } = await supabase
      .from('beds')
      .select('id, rooms!inner(organization_id)')
      .eq('id', bed_id)
      .single()
    const bedRoomOrg = (bedData?.rooms as unknown as { organization_id: string })?.organization_id
    if (!bedData || bedRoomOrg !== orgId) {
      return NextResponse.json({ error: 'Łóżko nie należy do Twojej placówki' }, { status: 403 })
    }

    // 1. Sprawdź czy podopieczny ma już aktywne przypisanie
    const { data: activeAssignments, error: checkError } = await supabase
      .from('bed_assignments')
      .select('id, bed_id')
      .eq('resident_id', resident_id)
      .is('unassigned_at', null)

    if (checkError) {
      return NextResponse.json({ error: 'Błąd podczas weryfikacji przypisania' }, { status: 500 })
    }

    if (activeAssignments && activeAssignments.length > 0) {
      const currentBedId = activeAssignments[0].bed_id
      if (currentBedId === bed_id) {
        return NextResponse.json({ error: 'Podopieczny jest już przypisany do tego łóżka' }, { status: 400 })
      }
      
      // Transfer do nowego łóżka
      const { error: transferError } = await supabase.rpc('transfer_resident_bed', {
        p_resident_id: resident_id,
        p_new_bed_id: bed_id
      })

      if (transferError) {
        console.error('Failed to transfer bed assignment:', transferError)
        return NextResponse.json({ error: 'Błąd podczas przenoszenia: ' + transferError.message }, { status: 500 })
      }
    } else {
      // Nowe przypisanie
      const { error: assignError } = await supabase
        .from('bed_assignments')
        .insert({
          bed_id,
          resident_id,
          reason: reason || 'initial_assignment'
        })

      if (assignError) {
        console.error('Failed to assign bed:', assignError)
        return NextResponse.json({ error: 'Błąd podczas przypisywania: ' + assignError.message }, { status: 500 })
      }
    }

    // Audyt
    if (orgId) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const adminClient = createAdminClient()
      await adminClient.from('audit_logs').insert({
        organization_id: orgId,
        resident_id,
        action: 'BED_ASSIGNED',
        performed_by: user.id,
        payload: { bed_id, resident_id, reason: reason || 'assignment' }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Wystąpił nieoczekiwany błąd serwera' }, { status: 500 })
  }
}
