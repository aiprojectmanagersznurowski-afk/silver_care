import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isImpersonationSessionActive } from '@/lib/impersonation-guards'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
    }

    const cookieStore = await cookies()
    if (isImpersonationSessionActive(cookieStore, user)) {
      return NextResponse.json({ error: 'Operacja niedozwolona w trybie podglądu' }, { status: 403 })
    }

    // ZSN wynika z dokumentacji przyjęcia: zmienia go rola z prawem zapisu residents (MATRIX), nie personel opiekuńczy
    const role = user.app_metadata?.role
    if (role !== 'org_admin' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Status ZSN zmienia kierownik placówki' }, { status: 403 })
    }

    const orgId = user.app_metadata?.organization_id
    if (orgId && role !== 'super_admin') {
      const { data: resData } = await supabase
        .from('residents')
        .select('organization_id')
        .eq('id', id)
        .single()
      if (!resData || resData.organization_id !== orgId) {
        return NextResponse.json({ error: 'Podopieczny nie należy do Twojej placówki' }, { status: 403 })
      }
    }

    const body = await request.json()
    const { is_zsn } = body

    if (typeof is_zsn !== 'boolean') {
      return NextResponse.json({ error: 'Pole is_zsn musi być typu boolean' }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('residents')
      .update({ is_zsn })
      .eq('id', id)
      .select('id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    // RLS nie zgłasza błędu przy odciętym zapisie, tylko nie zmienia wiersza — to nie jest sukces
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Nie zapisano zmiany ZSN: brak uprawnień albo podopieczny nie istnieje' }, { status: 403 })
    }

    return NextResponse.json({ success: true, is_zsn })
  } catch {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 })
  }
}
