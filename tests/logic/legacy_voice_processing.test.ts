import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), from: vi.fn(), complete: vi.fn(), redact: vi.fn(), save: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/feature-flags', () => ({ assertOrgFeatureForApi: async () => null, isOrgFeatureEnabled: async () => true }))
vi.mock('@/lib/impersonation-guards', () => ({ isImpersonationSessionActive: () => false, safeGetCookieStore: async () => ({}) }))
vi.mock('next/headers', () => ({ cookies: async () => ({}) }))
vi.mock('next/headers.js', () => ({ cookies: async () => ({}) }))
vi.mock('@/lib/eu-llm-client', () => ({ callEuLlmCompletion: mocks.complete }))
vi.mock('@/lib/voice-private-speech', () => ({ readSpeechConfiguration: () => ({}), redactPrivately: mocks.redact }))
vi.mock('@/lib/voice-process-persistence', () => ({ saveProcessedVoiceDraft: mocks.save }))

import { POST } from '../../apps/web/src/app/api/voice/process/route'

const user = { id: 'staff-1', app_metadata: { role: 'nurse', organization_id: 'our-site' } }
const draft = { id: 'draft-1', resident_id: 'resident-1', transcript: 'Anna Testowa zjadła obiad.', status: 'DRAFT' }

function session(aal: string) {
  mocks.createClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }), getClaims: async () => ({ data: { claims: { sub: user.id, aal } } }) },
    from: mocks.from, rpc: async () => ({ data: false }),
  })
}

function request() {
  return new NextRequest('http://localhost/api/voice/process', {
    method: 'POST', headers: { authorization: 'Bearer fixture' }, body: JSON.stringify({ draftId: draft.id }),
  })
}

const route = { params: Promise.resolve({}) }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ data: draft }) }) }) })
  mocks.save.mockResolvedValue({ success: true })
})

it('odmawia bez MFA przed odczytem szkicu @REQ: SEC-MFA-STAFF', async () => {
  session('aal1')
  expect((await POST(request(), route)).status).toBe(403)
  expect(mocks.from).not.toHaveBeenCalled()
  expect(mocks.complete).not.toHaveBeenCalled()
})

it('zachowuje szkic i nie wywołuje modelu bez działającej redakcji @REQ: VOICE-MEDICAL-STRIP', async () => {
  session('aal2')
  mocks.redact.mockRejectedValue(new Error('VOICE_REDACTION_UNAVAILABLE'))
  expect((await POST(request(), route)).status).toBe(503)
  expect(mocks.complete).not.toHaveBeenCalled()
  expect(mocks.save).not.toHaveBeenCalled()
})

it('przekazuje klasyfikatorowi tekst po prywatnej redakcji @REQ: VOICE-ZERO-GUESSING', async () => {
  session('aal2')
  mocks.redact.mockResolvedValue('Podopieczna zjadła obiad.')
  mocks.complete.mockResolvedValueOnce(JSON.stringify({ behavioral: 'Zjadła obiad.' }))
    .mockResolvedValueOnce('Twój bliski zjadł obiad.')
  expect((await POST(request(), route)).status).toBe(200)
  expect(mocks.complete.mock.calls[0][0][1].content).toBe('Podopieczna zjadła obiad.')
})
