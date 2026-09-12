import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    const role = user.app_metadata?.role
    if (role !== 'org_admin' && role !== 'super_admin' && role !== 'nurse') {
      return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })
    }

    const body = await request.json()
    const { is_zsn } = body

    if (typeof is_zsn !== 'boolean') {
      return NextResponse.json({ error: 'Pole is_zsn musi być typu boolean' }, { status: 400 })
    }

    const { error } = await supabase
      .from('residents')
      .update({ is_zsn })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, is_zsn })
  } catch {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 })
  }
}
