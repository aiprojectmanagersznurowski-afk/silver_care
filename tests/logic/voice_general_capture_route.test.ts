import { beforeEach, describe, expect, it, vi } from 'vitest'

const owner = 'a4d39bb5-db96-4402-82db-7602fff489e6'
const org = '0f52ca6a-5fee-4df3-aaa1-0a55562ecdda'
const capture = '9767c130-be6e-4e8d-92c7-f47096b39490'
const mocks = vi.hoisted(() => ({ from: vi.fn(), upload: vi.fn(), download: vi.fn(), currentLevel: 'aal2' }))
vi.mock('@/lib/api-auth', () => ({ withAuth: (handler: (request: Request, context: unknown) => unknown) =>
  (request: Request) => handler(request, {
    user: { id: owner, organizationId: org },
    supabase: { auth: { mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: mocks.currentLevel } }) } } },
  }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({
  from: mocks.from,
  storage: { from: () => ({ upload: mocks.upload, download: mocks.download }) },
}) }))

import { POST } from '../../apps/web/src/app/api/voice/captures/route'

function request(authoredBy = owner, magic = [0x1a, 0x45, 0xdf, 0xa3]) {
  const form = new FormData()
  form.set('file', new File([new Uint8Array(magic)], 'test.webm', { type: 'audio/webm' }))
  form.set('client_uuid', capture)
  form.set('author_id', authoredBy)
  return new Request('http://localhost/api/voice/captures', { method: 'POST', body: form })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.currentLevel = 'aal2'
})

describe('Przyjęcie nagrania ogólnego', () => {
  it('odrzuca wysłanie nagrania innej sesji i plik z błędną sygnaturą @REQ: VOICE-RESIDENT-ASSIGN', async () => {
    const post = POST as unknown as (request: Request) => Promise<Response>
    expect((await post(request(org))).status).toBe(403)
    expect((await post(request(owner, [1, 2, 3, 4]))).status).toBe(400)
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('wymaga drugiego składnika dla surowych nagrań @REQ: SEC-MFA-STAFF', async () => {
    mocks.currentLevel = 'aal1'
    const post = POST as unknown as (request: Request) => Promise<Response>
    expect((await post(request())).status).toBe(403)
    expect(mocks.upload).not.toHaveBeenCalled()
  })
})
