import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * @REQ: ADM-RESIDENT-ADD
 * Endpoint zarządzania załącznikiem umowy pensjonariusza (contract_document).
 */
export async function POST(
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
    if (role !== 'org_admin' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Brak uprawnień. Tylko administrator placówki może zarządzać umowami.' }, { status: 403 })
    }

    const orgId = user.app_metadata?.organization_id
    if (!orgId) {
      return NextResponse.json({ error: 'Brak identyfikatora placówki w sesji.' }, { status: 403 })
    }

    const body = await request.json()
    const { storage_path, file_name, content_type } = body

    if (!storage_path || typeof storage_path !== 'string') {
      return NextResponse.json({ error: 'Brak lub niepoprawna ścieżka do pliku' }, { status: 400 })
    }

    // 1. Sprawdź czy pensjonariusz należy do placówki administratora
    const { data: resident, error: fetchErr } = await supabase
      .from('residents')
      .select('id, organization_id')
      .eq('id', id)
      .single()

    if (fetchErr || !resident || resident.organization_id !== orgId) {
      return NextResponse.json({ error: 'Nie znaleziono pensjonariusza w placówce' }, { status: 404 })
    }

    // 2. Aktualizuj dane w tabeli residents
    const { error: updateErr } = await supabase
      .from('residents')
      .update({
        contract_document_path: storage_path,
        contract_document_name: file_name || 'Umowa',
      })
      .eq('id', id)

    if (updateErr) {
      return NextResponse.json({ error: 'Błąd zapisu umowy: ' + updateErr.message }, { status: 500 })
    }

    // 3. Dodaj wpis do resident_media w celu zachowania spójności galerii/dokumentów
    await supabase
      .from('resident_media')
      .insert({
        resident_id: id,
        storage_path,
        content_type: content_type || 'application/pdf',
        uploaded_by: user.id,
      })

    return NextResponse.json({
      success: true,
      contract_document_path: storage_path,
      contract_document_name: file_name || 'Umowa',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Nieoczekiwany błąd serwera'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
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
    if (role !== 'org_admin' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })
    }

    const orgId = user.app_metadata?.organization_id
    if (!orgId) {
      return NextResponse.json({ error: 'Brak identyfikatora placówki' }, { status: 403 })
    }

    const { data: resident, error: fetchErr } = await supabase
      .from('residents')
      .select('id, organization_id, contract_document_path')
      .eq('id', id)
      .single()

    if (fetchErr || !resident || resident.organization_id !== orgId) {
      return NextResponse.json({ error: 'Nie znaleziono pensjonariusza w placówce' }, { status: 404 })
    }

    // Usunięcie powiązania
    const { error: updateErr } = await supabase
      .from('residents')
      .update({
        contract_document_path: null,
        contract_document_name: null,
      })
      .eq('id', id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Błąd serwera'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
