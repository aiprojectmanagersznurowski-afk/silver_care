import { OPERATIONAL_REPORT_ENGINE, RESIDENT_ASSIGNMENT, VOICE_RETENTION } from '@silvercare/contracts/src/generated/voice'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { staffMfaSatisfied } from '@/lib/auth/staff-mfa'
import { parseAuditDate } from '@/lib/audit-helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { clipVoiceAudio } from '@/lib/voice-audio-clip'

export const runtime = 'nodejs'

const review = RESIDENT_ASSIGNMENT.sourceReview
const options = { roles: [review.facilityRole, review.shiftLeadRole], requireOrganization: true,
  blockImpersonation: true, requiredFeature: OPERATIONAL_REPORT_ENGINE.moduleKey }
const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const badInput = 'Sprawdź dane decyzji i ponów zapis.'
const missingAudio = 'Nagranie do odsłuchu jest niedostępne.'

function uuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value)
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

function mutationError(error: { code: string; message: string }) {
  if (error.code === '42501') return fail('Brak dostępu do tego fragmentu lub zmiany.', 403)
  if (error.code === 'PT409' || error.message === 'VOICE_REVIEW_CONFLICT') return fail('Stan fragmentu się zmienił. Odśwież kolejkę i sprawdź go ponownie.', 409)
  if (error.message === 'VOICE_LOCAL_TIME_INVALID') return fail('Wybierz istniejącą godzinę sprzed przyjęcia nagrania.', 422)
  if (error.message === 'VOICE_SHIFT_NOT_UNIQUE') return fail('Nie znaleziono jednej aktywnej zmiany dla podanego czasu.', 422)
  if (error.message === 'VOICE_AUDIO_UNAVAILABLE') return fail(missingAudio, 422)
  if (error.message === 'VOICE_SEGMENT_SOURCE_REVIEW_REQUIRED') return fail('Najpierw wyjaśnij czas lub podziel materiał mieszany.', 422)
  return fail(badInput, 422)
}

export const POST = withAuth(async (request, { supabase, accessToken }) => {
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(accessToken)
  if (!await staffMfaSatisfied(supabase, assurance?.currentLevel, review.requiredAal)) return fail('Potwierdź drugi składnik uwierzytelniania.', 403)
  if (Number(request.headers.get('content-length')) > 4096) return fail(badInput, 413)
  const raw = await request.text().catch(() => '')
  if (raw.length > 4096) return fail(badInput, 413)
  let input: unknown
  try { input = JSON.parse(raw) } catch { return fail(badInput, 400) }
  if (!record(input) || !uuid(input.segmentId)) return fail(badInput, 400)

  const p_segment_id = input.segmentId
  const p_expected_version = input.expectedVersion
  const p_request_id = input.requestId
  const action = input.action
  if (action === undefined && p_expected_version === undefined && p_request_id === undefined) {
    const scope = RESIDENT_ASSIGNMENT.outcomes.find((item) => item === input.scope)
    if (!scope || (scope === 'RESIDENT' ? !uuid(input.residentId) : Boolean(input.residentId))
      || (input.authorId && !uuid(input.authorId))) return fail(badInput, 400)
    const result = await supabase.rpc('resolve_voice_segment', {
      p_segment_id, p_scope: scope, p_resident_id: uuid(input.residentId) ? input.residentId : undefined,
      p_author_id: uuid(input.authorId) ? input.authorId : undefined,
    })
    return result.error ? mutationError(result.error) : NextResponse.json({ success: true })
  }

  if (!uuid(p_request_id) || !integer(p_expected_version) || p_expected_version < 0
    || p_expected_version > 2_147_483_647) return fail(badInput, 400)
  const command = { p_segment_id, p_expected_version, p_request_id }
  if (action === 'time') {
    const p_mode = review.timeModes.find((mode) => mode === input.mode)
    const p_basis = review.bases.find((basis) => basis === input.basis)
    if (!p_mode || !p_basis) return fail(badInput, 400)
    const args = { ...command, p_mode, p_basis }
    if (p_mode === 'SHIFT_ONLY') {
      const shiftDate = parseAuditDate(typeof input.shiftDate === 'string' ? input.shiftDate : undefined)
      if (!uuid(input.shiftDefinitionId) || !shiftDate) return fail(badInput, 400)
      const result = await supabase.rpc('correct_voice_segment_time', {
        ...args, p_shift_definition_id: input.shiftDefinitionId, p_shift_date: shiftDate,
      })
      return result.error ? mutationError(result.error) : NextResponse.json(result.data)
    }
    if (typeof input.localStart !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(input.localStart)
      || !integer(input.utcOffsetMinutes)) return fail(badInput, 400)
    const result = await supabase.rpc('correct_voice_segment_time', {
      ...args, p_local_start: input.localStart, p_utc_offset_minutes: input.utcOffsetMinutes,
    })
    return result.error ? mutationError(result.error) : NextResponse.json(result.data)
  }

  if (action === 'split') {
    const parts: unknown = input.parts
    if (!Array.isArray(parts) || parts.length < 2 || parts.length > review.splitMaxParts
      || !parts.every((part) => record(part) && integer(part.start_ms) && integer(part.end_ms)
        && typeof part.excluded === 'boolean')) return fail(badInput, 400)
    const result = await supabase.rpc('split_voice_segment', {
      ...command, p_parts: parts.map(({ start_ms, end_ms, excluded }) => ({ start_ms, end_ms, excluded })),
    })
    return result.error ? mutationError(result.error) : NextResponse.json(result.data)
  }

  const scope = RESIDENT_ASSIGNMENT.outcomes.find((item) => item === input.scope)
  if (action !== 'scope' || !scope || (scope === 'RESIDENT' ? !uuid(input.residentId) : Boolean(input.residentId))
    || (input.authorId && !uuid(input.authorId))) return fail(badInput, 400)
  const result = await supabase.rpc('review_voice_segment_scope', {
    ...command, p_scope: scope, p_resident_id: uuid(input.residentId) ? input.residentId : undefined,
    p_author_id: uuid(input.authorId) ? input.authorId : undefined,
  })
  return result.error ? mutationError(result.error) : NextResponse.json(result.data)
}, options)

function audioResponse(clip: Blob, range: string | null) {
  const headers = new Headers({ 'Content-Type': clip.type, 'Cache-Control': 'private, no-store', 'Accept-Ranges': 'bytes' })
  if (!range) {
    headers.set('Content-Length', String(clip.size))
    return new NextResponse(clip.stream(), { headers })
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range)
  const first = match?.[1] ? Number(match[1]) : Math.max(0, clip.size - Number(match?.[2]))
  const last = match?.[1] && match[2] ? Math.min(Number(match[2]), clip.size - 1) : clip.size - 1
  if (!match || (!match[1] && !match[2]) || !integer(first) || !integer(last) || first > last) {
    headers.set('Content-Range', `bytes */${clip.size}`)
    return new NextResponse(null, { status: 416, headers })
  }
  headers.set('Content-Range', `bytes ${first}-${last}/${clip.size}`)
  headers.set('Content-Length', String(last - first + 1))
  return new NextResponse(clip.slice(first, last + 1).stream(), { status: 206, headers })
}

export const GET = withAuth(async (request, { user, supabase, accessToken }) => {
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(accessToken)
  if (!await staffMfaSatisfied(supabase, assurance?.currentLevel, review.requiredAal)) return fail('Potwierdź drugi składnik uwierzytelniania.', 403)
  const id = request.nextUrl.searchParams.get('segment')
  if (!uuid(id) || !user.organizationId) return fail(missingAudio, 404)
  const permission = () => supabase.rpc('can_play_voice_segment', { p_segment_id: id })
  if (!(await permission()).data) return fail(missingAudio, 404)

  const admin = createAdminClient()
  const { data: segment } = await admin.from(RESIDENT_ASSIGNMENT.segmentResource)
    .select('start_ms, end_ms, voice_captures(storage_path, sha256)')
    .eq('organization_id', user.organizationId).eq('id', id).eq('assignment_status', 'PENDING').maybeSingle()
  const source = segment?.voice_captures
  if (!segment || !source) return fail(missingAudio, 404)
  const { data: original } = await admin.storage.from(VOICE_RETENTION.storageBucket).download(source.storage_path)
  if (!original) return fail(missingAudio, 404)
  try {
    const clip = await clipVoiceAudio(original, source.sha256, segment.start_ms, segment.end_ms)
    if (!(await permission()).data) return fail(missingAudio, 404)
    return audioResponse(clip, request.headers.get('range'))
  } catch {
    return fail(missingAudio, 422)
  }
}, options)
