import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { OPERATIONAL_REPORT_ENGINE, RESIDENT_ASSIGNMENT, VOICE_RETENTION } from '@silvercare/contracts/src/generated/voice'
import { withAuth } from '@/lib/api-auth'
import { staffMfaSatisfied } from '@/lib/auth/staff-mfa'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Tables } from '@/types/database.types'

export const runtime = 'nodejs'

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const maxAudioBytes = 4 * 1024 * 1024
type CaptureReceipt = Pick<Tables<'voice_captures'>, 'id' | 'sha256' | 'source' | 'selected_resident_id'>
const sha256 = (data: ArrayBuffer) => createHash('sha256').update(new Uint8Array(data)).digest('hex')

function failure(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function accepted(id: string) {
  return NextResponse.json({ success: true, captureId: id }, { status: 202 })
}

function audioType(declared: string, bytes: ArrayBuffer) {
  const magic = Buffer.from(bytes, 0, Math.min(bytes.byteLength, 12))
  const type = declared.split(';', 1)[0].toLowerCase()
  if (type === 'audio/webm' && magic.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return type
  if (type === 'audio/ogg' && magic.toString('ascii', 0, 4) === 'OggS') return type
  if (['audio/mp4', 'audio/m4a', 'audio/x-m4a'].includes(type) && magic.toString('ascii', 4, 8) === 'ftyp') return 'audio/mp4'
  if (['audio/wav', 'audio/wave', 'audio/x-wav'].includes(type) && magic.toString('ascii', 0, 4) === 'RIFF'
    && magic.toString('ascii', 8, 12) === 'WAVE') return 'audio/wav'
  return null
}

export const POST = withAuth(async (request, { user, supabase, accessToken }) => {
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(accessToken)
  if (!await staffMfaSatisfied(supabase, assurance?.currentLevel)) return failure('Potwierdź drugi składnik uwierzytelniania.', 403)
  const intendedSize = Number(request.headers.get('content-length'))
  if (intendedSize > maxAudioBytes + 32_768) return failure('Nagranie przekracza dozwolony rozmiar.', 413)

  const data = await request.formData().catch(() => null)
  const file = data?.get('file')
  const clientUuid = data?.get('client_uuid')
  const selected = data?.get('purpose') === 'resident_capture'
  const resident = data?.get('resident_id')
  if (!data || !(file instanceof File) || !file.size || file.size > maxAudioBytes
    || typeof clientUuid !== 'string' || !uuid.test(clientUuid) || !user.organizationId
    || (selected ? typeof resident !== 'string' || !uuid.test(resident) : resident !== null)) {
    return failure('Nieprawidłowe nagranie.', 400)
  }
  if (data.get('author_id') !== user.id) return failure('Nagranie należy do innej sesji personelu.', 403)
  const bytes = await file.arrayBuffer()
  const mimeType = audioType(file.type, bytes)
  if (!mimeType) return failure('Nieprawidłowy format nagrania.', 400)

  const orgId = user.organizationId
  const source = selected ? RESIDENT_ASSIGNMENT.selectedResidentReview.source : 'APP_GENERAL'
  const sourceKey = clientUuid.toLowerCase()
  const residentId = typeof resident === 'string' ? resident.toLowerCase() : null
  const hash = sha256(bytes)
  const path = `${orgId}/${source.toLowerCase()}/${user.id}/${sourceKey}`
  const admin = createAdminClient()
  const storage = admin.storage.from(VOICE_RETENTION.storageBucket)
  const captures = () => admin.from(RESIDENT_ASSIGNMENT.captureResource)
  const findCapture = () => captures().select('id, sha256, source, selected_resident_id')
    .eq('organization_id', orgId).eq('author_id', user.id).eq('source_key', sourceKey)
    .neq('source', 'DEVICE').maybeSingle()
  const replay = (capture: CaptureReceipt) =>
    capture.sha256 === hash && capture.source === source && capture.selected_resident_id === residentId
      ? accepted(capture.id) : failure('Ten identyfikator należy do innego nagrania.', 409)

  const previous = await findCapture()
  if (previous.error) return failure('Nie udało się potwierdzić zapisu nagrania.', 503)
  if (previous.data) return replay(previous.data)

  if (residentId) {
    const permitted = await supabase.from('residents').select('id')
      .eq('id', residentId).eq('organization_id', orgId).is('archived_at', null).maybeSingle()
    if (permitted.error) return failure('Nie udało się sprawdzić dostępu do karty podopiecznego.', 503)
    if (!permitted.data) return failure('Podopieczny jest niedostępny w tej placówce.', 403)
  }

  const stored = await storage.upload(path, bytes, { contentType: mimeType, upsert: false })
  if (stored.error) {
    const existing = await storage.download(path)
    if (existing.error || !existing.data) return failure('Nie udało się zapisać nagrania.', 503)
    if (sha256(await existing.data.arrayBuffer()) !== hash) {
      return failure('Ten identyfikator należy do innego nagrania.', 409)
    }
  }

  const recordedAt = data.get('recorded_at')
  const recorded = typeof recordedAt === 'string' ? Date.parse(recordedAt) : NaN
  const received = Date.now()
  const synced = Number.isFinite(recorded) && recorded <= received + 60_000
  const result = await captures().insert({
    organization_id: orgId, author_id: user.id, source, source_key: sourceKey, selected_resident_id: residentId,
    storage_path: path, sha256: hash, recorded_at: new Date(synced ? recorded : received).toISOString(),
    clock_state: synced ? 'SYNCED' : 'UNKNOWN',
  }).select('id').single()
  if (!result.error && result.data) return accepted(result.data.id)

  if (result.error?.code === '23505') {
    const other = await findCapture()
    if (other.data) return replay(other.data)
  }
  return failure('Nagranie czeka na ponowienie zapisu.', 503)
}, {
  roles: ['org_admin', 'nurse'],
  requireOrganization: true,
  blockImpersonation: true,
  requiredFeature: OPERATIONAL_REPORT_ENGINE.moduleKey,
})
