import { NextResponse } from 'next/server'
import { OPERATIONAL_REPORT_ENGINE } from '@silvercare/contracts/src/generated/voice'
import { withAuth } from '@/lib/api-auth'

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i

export const POST = withAuth(async (request, { supabase }) => {
  const input = await request.json().catch(() => null)
  if (typeof input?.reportId !== 'string' || !uuid.test(input.reportId)) {
    return NextResponse.json({ error: 'Wybierz raport do zatwierdzenia.' }, { status: 400 })
  }
  const { error } = await supabase.rpc('approve_operational_report', { p_report_id: input.reportId })
  if (error?.code === '42501') return NextResponse.json({ error: 'Brak dostępu do raportu.' }, { status: 403 })
  if (error) return NextResponse.json({ error: 'Odśwież raport przed zatwierdzeniem.' }, { status: 409 })
  return NextResponse.json({ success: true })
}, { roles: ['org_admin', 'nurse'], requireOrganization: true,
  blockImpersonation: true, requiredFeature: OPERATIONAL_REPORT_ENGINE.moduleKey })
