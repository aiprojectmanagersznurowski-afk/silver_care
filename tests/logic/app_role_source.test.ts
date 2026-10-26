import { describe, it, expect, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { withAuth } from '../../apps/web/src/lib/api-auth'
import { getAppRole, getAppOrganizationId } from '../../apps/web/src/lib/auth/app-role'
import { checkWrite, kkConfig } from '../../tools/guard-core.mjs'

/**
 * @REQ: SUP-IAM-PANEL
 * @REQ: ORG-ISOLATION
 *
 * Rola i placówka pochodzą wyłącznie z app_metadata (ustawia je tylko serwer). user_metadata użytkownik
 * edytuje sam (supabase.auth.updateUser), więc nigdy nie może nadać roli ani placówki. Rola spoza
 * kontraktu (np. dawne caregiver, paramedic, facility_manager, admin) nie jest rolą.
 */

const asUser = (app: Record<string, unknown>, meta: Record<string, unknown> = {}) =>
  ({ id: 'u1', email: 'x@example.test', app_metadata: app, user_metadata: meta }) as never

function mockSession(user: unknown) {
  vi.mocked(createClient).mockResolvedValueOnce({
    auth: { getUser: vi.fn().mockResolvedValueOnce({ data: { user }, error: null }) },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

describe('getAppRole i getAppOrganizationId (@REQ: SUP-IAM-PANEL)', () => {
  it('@REQ: SUP-IAM-PANEL - rola tylko z app_metadata i tylko z kontraktu', () => {
    for (const role of ['super_admin', 'org_admin', 'nurse', 'legal_guardian', 'family']) {
      expect(getAppRole(asUser({ role }))).toBe(role)
    }
    expect(getAppRole(asUser({}, { role: 'super_admin' }))).toBeNull()
    for (const legacy of ['caregiver', 'paramedic', 'facility_manager', 'admin', 'authenticated', '']) {
      expect(getAppRole(asUser({ role: legacy })), legacy).toBeNull()
    }
    expect(getAppRole(null)).toBeNull()
  })

  it('@REQ: ORG-ISOLATION - placówka tylko z app_metadata', () => {
    expect(getAppOrganizationId(asUser({ organization_id: 'org-1' }))).toBe('org-1')
    expect(getAppOrganizationId(asUser({}, { organization_id: 'org-2' }))).toBeNull()
  })
})

describe('withAuth nie przyjmuje roli ani placówki z user_metadata (@REQ: SUP-IAM-PANEL, @REQ: ORG-ISOLATION)', () => {
  it('@REQ: SUP-IAM-PANEL - rola wpisana w user_metadata nie przechodzi kontroli ról (403)', async () => {
    mockSession(asUser({}, { role: 'org_admin' }))
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    const res = await withAuth(handler, { roles: ['org_admin'] })(new NextRequest('http://localhost/api/x'))
    expect(res.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it('@REQ: ORG-ISOLATION - placówka z user_metadata nie trafia do kontekstu żądania', async () => {
    mockSession(asUser({ role: 'org_admin' }, { organization_id: 'org-cudza' }))
    let seen: unknown = 'nie wywołano'
    const handler = vi.fn(async (_req: unknown, ctx: { user: { organizationId?: string } }) => {
      seen = ctx.user.organizationId
      return NextResponse.json({ ok: true })
    })
    const res = await withAuth(handler as never, { roles: ['org_admin'] })(new NextRequest('http://localhost/api/x'))
    expect(res.status).toBe(200)
    expect(seen).toBeUndefined()
  })
})

describe('Reguła bramki auth-role-from-user-metadata (@REQ: SUP-IAM-PANEL)', () => {
  const FILE = 'apps/web/src/app/(admin)/layout.tsx'

  it('@REQ: SUP-IAM-PANEL - reguła istnieje i jest blokująca', () => {
    const rule = kkConfig.forbiddenPatterns.find((p: { id: string }) => p.id === 'auth-role-from-user-metadata')
    expect(rule).toBeDefined()
    expect(rule.severity).not.toBe('warn')
  })

  it('@REQ: SUP-IAM-PANEL - blokuje odczyt roli i placówki z user_metadata', () => {
    for (const code of [
      'const role = user?.app_metadata?.role || user?.user_metadata?.role',
      "u.user_metadata?.role === 'org_admin'",
      '(rawUser.user_metadata?.organization_id as string)',
      'const r = user.user_metadata.role',
    ]) {
      const res = checkWrite(FILE, code)
      expect(res.blocked, code).toBe(true)
      expect(res.rule, code).toBe('auth-role-from-user-metadata')
    }
  })

  it('@REQ: SUP-IAM-PANEL - przepuszcza inne pola user_metadata (np. telefon, zdjęcie) i testy', () => {
    expect(checkWrite(FILE, 'staffUser.user_metadata?.avatar_url').blocked).toBe(false)
    expect(checkWrite(FILE, "user_metadata: { phone: '1' }").blocked).toBe(false)
    expect(checkWrite('tests/logic/x.test.ts', 'user_metadata?.role').blocked).toBe(false)
  })
})
