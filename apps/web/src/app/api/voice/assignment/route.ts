import { RESIDENT_ASSIGNMENT, OPERATIONAL_REPORT_ENGINE } from '@silvercare/contracts/src/generated/voice'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i

export const POST = withAuth(async (request, { supabase }) => {
  const size = Number(request.headers.get('content-length'))
  if (size > 4096) return NextResponse.json({ error: 'Nieprawidłowe przypisanie.' }, { status: 413 })
  const input = await request.json().catch(() => null)
  const { segmentId, scope, residentId, authorId } = input ?? {}
  if (!uuid.test(segmentId) || !RESIDENT_ASSIGNMENT.outcomes.includes(scope)
    || (scope === 'RESIDENT' ? !uuid.test(residentId) : Boolean(residentId))
    || (authorId && !uuid.test(authorId))) {
    return NextResponse.json({ error: 'Nieprawidłowe przypisanie.' }, { status: 400 })
  }
  const { error } = await supabase.rpc('resolve_voice_segment', {
    p_segment_id: segmentId, p_scope: scope, p_resident_id: residentId || undefined,
    p_author_id: authorId || undefined,
  })
  if (error?.code === '42501') return NextResponse.json({ error: 'Brak dostępu do tego fragmentu.' }, { status: 403 })
  if (error) return NextResponse.json({ error: 'Sprawdź zakres i autora fragmentu, a następnie ponów zapis.' }, { status: 422 })
  return NextResponse.json({ success: true })
}, { roles: ['org_admin', 'nurse'], requireOrganization: true,
  blockImpersonation: true, requiredFeature: OPERATIONAL_REPORT_ENGINE.moduleKey })
