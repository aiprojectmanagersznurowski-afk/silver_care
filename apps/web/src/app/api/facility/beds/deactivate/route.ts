import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { isImpersonationSessionActive } from '@/lib/impersonation-guards'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
    }

    const role = user.app_metadata?.role as string | undefined
    if (!['org_admin', 'super_admin'].includes(role || '')) {
      return NextResponse.json({ error: 'Brak uprawnień kierownika placówki' }, { status: 403 })
    }

    const cookieStore = await cookies()
    if (isImpersonationSessionActive(cookieStore, user)) {
      return NextResponse.json({ error: 'Operacja niedozwolona w trybie podglądu (impersonacji).' }, { status: 403 })
    }

    const orgId = user.app_metadata?.organization_id as string | undefined
    const body = await request.json()
    const { bed_id, is_active } = body

    if (!bed_id || typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'Brak wymaganych danych (bed_id, is_active)' }, { status: 400 })
    }

    // Weryfikacja izolacji placówki (cross-tenant check)
    if (role !== 'super_admin') {
      const { data: bedData } = await supabase
        .from('beds')
        .select('id, rooms!inner(organization_id)')
        .eq('id', bed_id)
        .single()
      const bedRoomOrg = (bedData?.rooms as unknown as { organization_id: string })?.organization_id
      if (!bedData || bedRoomOrg !== orgId) {
        return NextResponse.json({ error: 'Łóżko nie należy do Twojej placówki' }, { status: 403 })
      }
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

    if (orgId) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const adminClient = createAdminClient()
      await adminClient.from('audit_logs').insert({
        organization_id: orgId,
        resident_id: null,
        action: is_active ? 'BED_ACTIVATED' : 'BED_DEACTIVATED',
        performed_by: user.id,
        payload: { bed_id, is_active }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Wystąpił nieoczekiwany błąd serwera' }, { status: 500 })
  }
}
