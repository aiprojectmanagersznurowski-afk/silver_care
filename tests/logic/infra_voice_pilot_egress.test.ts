import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { POST as transcribe } from '@/app/api/voice/transcribe/route'
import { callEuLlmCompletion } from '@/lib/eu-llm-client'
import { featureSnapshot } from '../helpers/feature-snapshot.test.fixture'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: () => ({ allowed: true }) }))

const messages = [{ role: 'user', content: 'Syntetyczna notatka o spacerze.' }] as const
const euEndpoint = 'https://api.mistral.ai/v1/chat/completions'

function mockStaffSession() {
  vi.mocked(createClient).mockResolvedValueOnce({
    rpc: async () => featureSnapshot(),
    auth: {
      getUser: async () => ({ data: { user: { id: 'nurse-fixture', app_metadata: { role: 'nurse', organization_id: 'org-fixture' } } } }),
      getClaims: async () => ({ data: { claims: { sub: 'nurse-fixture', aal: 'aal2' } } }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

describe('Dostawcy głosu w pilotażu z danymi rzeczywistymi', () => {
  const fetchSpy = vi.fn()

  beforeEach(() => {
    fetchSpy.mockReset()
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubEnv('VOICE_REAL_DATA_PILOT', 'true')
    vi.stubEnv('ALLOW_DEMO_GROQ_FALLBACK', 'true')
    vi.stubEnv('GROQ_API_KEY', 'synthetic-groq-key')
    vi.stubEnv('EU_LLM_API_KEY', undefined)
    vi.stubEnv('MISTRAL_API_KEY', undefined)
    vi.stubEnv('EU_LLM_ENDPOINT', euEndpoint)
    vi.stubEnv('EU_LLM_MODEL', 'mistral-small-latest')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('blokuje starszą transkrypcję Groq przed odczytem audio @REQ: INFRA-GROQ-TRANSCRIPTION', async () => {
    mockStaffSession()
    const form = new FormData()
    form.set('file', new Blob(['synthetic-audio'], { type: 'audio/webm' }), 'fixture.webm')
    const request = new Request('http://localhost/api/voice/transcribe', { method: 'POST', body: form })

    const response = await transcribe(request)

    expect(response.status).toBe(503)
    expect(request.bodyUsed).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('bez klucza EOG odmawia zamiast użyć fallbacku Groq @REQ: INFRA-GROQ-DEMO-INTERIM', async () => {
    fetchSpy.mockResolvedValue(Response.json({ choices: [{ message: { content: 'Odpowiedź demo' } }] }))

    await expect(callEuLlmCompletion([...messages])).rejects.toThrow('[EU-LLM-CONFIG]')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('z kluczem EOG wysyła żądanie wyłącznie do skonfigurowanego endpointu @REQ: INFRA-EU-REGION', async () => {
    vi.stubEnv('EU_LLM_API_KEY', 'synthetic-eu-key')
    fetchSpy.mockResolvedValue(Response.json({ choices: [{ message: { content: 'Odpowiedź EOG' } }] }))

    await expect(callEuLlmCompletion([...messages])).resolves.toBe('Odpowiedź EOG')
    expect(fetchSpy).toHaveBeenCalledExactlyOnceWith(euEndpoint, expect.objectContaining({
      body: JSON.stringify({ model: 'mistral-small-latest', messages, temperature: 0.1, max_tokens: 600 }),
      redirect: 'error',
    }))
  })
})
