import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function accepted(draft: { id: string; async_status: string | null }) {
  return NextResponse.json({
    success: true, draftId: draft.id, status: draft.async_status,
    message: 'Nagranie przyjęte do asynchronicznego przetworzenia w tle',
  }, { status: 202 })
}

export const POST = withAuth(async (req, { user }) => {
  const body: { resident_id?: unknown; client_uuid?: unknown; audio_url?: unknown } | null = await req.json().catch(() => null)
  const residentId = body?.resident_id
  if (typeof residentId !== 'string' || !residentId.trim()) {
    return NextResponse.json({ error: 'Brak identyfikatora podopiecznego' }, { status: 400 })
  }
  const clientUuid = typeof body?.client_uuid === 'string' ? body.client_uuid : null
  const audioUrl = typeof body?.audio_url === 'string' ? body.audio_url : 'local-pending-storage'
  const admin = createAdminClient()

  if (user.role !== 'super_admin') {
    const { data: resident } = await admin.from('residents').select('organization_id').eq('id', residentId).single()
    if (!resident || resident.organization_id !== user.organizationId) {
      return NextResponse.json({ error: 'Podopieczny nie należy do Twojej placówki' }, { status: 403 })
    }
  }

  const findPrevious = () => admin.from('voice_draft_notes').select('id, async_status')
    .match({ client_uuid: clientUuid, nurse_id: user.id, resident_id: residentId }).maybeSingle()
  if (clientUuid) {
    const { data } = await findPrevious()
    if (data) return accepted(data)
  }

  const { data, error } = await admin.from('voice_draft_notes').insert({
    resident_id: residentId, nurse_id: user.id, audio_url: audioUrl,
    client_uuid: clientUuid, status: 'DRAFT', async_status: 'QUEUED',
  }).select('id, async_status').single()
  if (!error && data) return accepted(data)

  if (clientUuid && error?.code === '23505') {
    const { data: previous } = await findPrevious()
    if (previous) return accepted(previous)
    return NextResponse.json({ error: 'Identyfikator nagrania jest już używany.' }, { status: 409 })
  }
  return NextResponse.json({ error: 'Nie udało się potwierdzić zapisu nagrania.' }, { status: 500 })
}, { roles: ['nurse', 'org_admin', 'super_admin'], requireOrganization: true,
  blockImpersonation: true, requiredFeature: 'module_voice_and_reports' })
