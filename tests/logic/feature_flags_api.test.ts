import { createHmac } from 'node:crypto'
import { featureSnapshot } from '../helpers/feature-snapshot.test.fixture'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as validateInvitation } from '@/app/api/family/invite/validate/route'
import { POST as polarEvent } from '@/app/api/polar/webhook/route'
import { GET as latestReport } from '@/app/api/residents/[id]/report/latest/route'
import { FEATURE_FLAG_POLICY } from '@silvercare/contracts/src/generated/features'

const { from, rpc, useSession } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), useSession: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from, rpc }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: () => ({ from, rpc, auth: { getUser: useSession } }) }))

const org = '6061863f-c8cf-4bb5-b7c0-b3fb669ba80c'
const resident = 'dbdc6c69-03c1-49da-b056-2a7f827dcef3'
const user = { id: '98b7910a-0124-4979-92d5-a634d43efbac', app_metadata: { role: 'family', organization_id: org } }

beforeEach(() => {
  from.mockReset()
  rpc.mockReset().mockResolvedValue({ data: false, error: null })
  useSession.mockReset().mockResolvedValue({ data: { user }, error: null })
})
afterEach(() => vi.unstubAllEnvs())

const queryFor = (data: unknown) => {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }) }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  return query
}

describe('@REQ: SUP-FEATURE-FLAGS', () => {
  it('blokuje najnowszy raport po wyłączeniu dowolnego z wymaganych modułów', async () => {
    for (const feature of ['module_residents_management', 'module_family_portal'] as const) {
      rpc.mockResolvedValueOnce(featureSnapshot({ [feature]: false }))
      const response = await latestReport(new Request(`https://test.local/api/residents/${resident}/report/latest`),
        { params: Promise.resolve({ id: resident }) })
      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ code: FEATURE_FLAG_POLICY.disabledErrorCode, feature })
      expect(rpc).toHaveBeenLastCalledWith('get_org_feature_flags', { p_org_id: org })
      expect(from).not.toHaveBeenCalled()
    }
  })

  it('odrzuca ważne zaproszenie z wyłączonym portalem', async () => {
    from.mockReturnValue(queryFor({
      id: resident, organization_id: org, role: 'family', expires_at: new Date(Date.now() + 60_000).toISOString(),
    }))
    const response = await validateInvitation(new NextRequest(`https://test.local/api/family/invite/validate?token=${resident}`))
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: FEATURE_FLAG_POLICY.disabledErrorCode, feature: 'module_family_portal' })
    expect(rpc).toHaveBeenCalledWith('has_org_feature', { p_org_id: org, p_feature_key: 'module_family_portal' })
  })

  it('sprawdza flagę opasek wyłącznie po zweryfikowaniu podpisu Polar', async () => {
    const secret = 'fixture-webhook-secret'
    vi.stubEnv('POLAR_WEBHOOK_SIGNATURE_SECRET', secret)
    const body = JSON.stringify({ event: 'EXERCISE', user_id: 17 })
    const url = 'https://test.local/api/polar/webhook'
    const denied = await polarEvent(new Request(url, { method: 'POST', body }))
    expect(denied.status).toBe(401)
    expect(from).not.toHaveBeenCalled()

    from.mockReturnValue(queryFor({ organization_id: org, resident_id: resident }))
    const signature = createHmac('sha256', secret).update(body).digest('hex')
    const response = await polarEvent(new Request(url, {
      method: 'POST', body, headers: { 'Polar-Webhook-Signature': signature },
    }))
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: FEATURE_FLAG_POLICY.disabledErrorCode, feature: 'module_wearables_iot' })
    expect(from.mock.calls).toEqual([['external_wearable_links']])
  })
})
