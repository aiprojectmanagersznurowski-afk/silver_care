import { NextResponse } from 'next/server'
import { OPERATIONAL_REPORT_ENGINE } from '@silvercare/contracts/src/generated/voice'
import { withAuth } from '@/lib/api-auth'

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i

export const POST = withAuth(async (request, { supabase }) => {
  const input = await request.json().catch(() => null)
  if (typeof input?.segmentId !== 'string' || !uuid.test(input.segmentId) || typeof input.accept !== 'boolean') {
    return NextResponse.json({ error: 'Wybierz fragment i decyzję.' }, { status: 400 })
  }
  const { data, error } = await supabase.rpc('review_voice_family_facts', {
    p_segment_id: input.segmentId, p_accept: input.accept,
  })
  if (error?.code === '42501') return NextResponse.json({ error: 'Brak dostępu do tych faktów.' }, { status: 403 })
  if (error?.message === 'VOICE_FAMILY_DRAFT_ALREADY_REVIEWED') {
    return NextResponse.json({ error: 'Szkic był już edytowany lub opublikowany. Sprawdź raport przed dodaniem kolejnych faktów.' }, { status: 409 })
  }
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać decyzji.' }, { status: 422 })
  return NextResponse.json({ reportId: data })
}, { roles: ['org_admin', 'nurse'], requireOrganization: true,
  blockImpersonation: true, requiredFeature: OPERATIONAL_REPORT_ENGINE.moduleKey })
