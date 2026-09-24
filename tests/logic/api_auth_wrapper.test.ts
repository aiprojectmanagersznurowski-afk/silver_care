import { describe, it, expect, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, handleApiError } from '../../apps/web/src/lib/api-errors'
import { withAuth } from '../../apps/web/src/lib/api-auth'

// Mock createClient
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'

describe('API Auth Wrapper & Error Handling (@REQ: SEC-SESSION, @REQ: SEC-NO-PII-LOGS, @REQ: SEC-403-LOGGING)', () => {
  it('masks internal server errors and SQL details without leaking PII @REQ: SEC-NO-PII-LOGS', async () => {
    const rawError = new Error('syntax error at or near "SELECT" table residents')
    const response = handleApiError(rawError, '/api/test')

    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json.code).toBe('INTERNAL_SERVER_ERROR')
    expect(json.error).toBe('Wystąpił nieoczekiwany błąd serwera.')
    expect(json.error_id).toBeDefined()
    // Upewnij się, że szczegóły SQL/tabel nie wyciekły
    expect(JSON.stringify(json)).not.toContain('residents')
    expect(JSON.stringify(json)).not.toContain('SELECT')
  })

  it('correctly maps known database constraint violations to HTTP codes @REQ: SEC-403-LOGGING', async () => {
    const uniqueViolation = { code: '23505', message: 'duplicate key' }
    const res409 = handleApiError(uniqueViolation)
    expect(res409.status).toBe(409)
    const json409 = await res409.json()
    expect(json409.code).toBe('RESOURCE_CONFLICT')

    const rlsViolation = { code: '42501', message: 'permission denied for table residents' }
    const res403 = handleApiError(rlsViolation)
    expect(res403.status).toBe(403)
    const json403 = await res403.json()
    expect(json403.code).toBe('PERMISSION_DENIED')
  })

  it('rejects unauthenticated requests with 401 status @REQ: SEC-SESSION', async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({ data: { user: null }, error: new Error('No session') }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    const wrapped = withAuth(handler)

    const req = new NextRequest('http://localhost:3000/api/protected')
    const response = await wrapped(req)

    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.code).toBe('UNAUTHORIZED')
    expect(handler).not.toHaveBeenCalled()
  })

  it('enforces RBAC role checks and rejects unauthorized roles with 403 @REQ: SEC-403-LOGGING', async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: {
            user: {
              id: 'u-123',
              email: 'family@example.com',
              app_metadata: { role: 'family', organization_id: 'org-1' },
            },
          },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    // Wymagaj roli personelu
    const wrapped = withAuth(handler, { roles: ['org_admin', 'nurse'] })

    const req = new NextRequest('http://localhost:3000/api/staff-only')
    const response = await wrapped(req)

    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.code).toBe('FORBIDDEN')
    expect(handler).not.toHaveBeenCalled()
  })

  it('passes authenticated user context and organization to handler @REQ: ORG-ISOLATION', async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: {
            user: {
              id: 'u-admin-1',
              email: 'admin@facility.pl',
              app_metadata: { role: 'org_admin', organization_id: 'org-42' },
            },
          },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const handler = vi.fn().mockImplementation(async (_req, ctx) => {
      return NextResponse.json({
        userId: ctx.user.id,
        role: ctx.user.role,
        orgId: ctx.user.organizationId,
      })
    })

    const wrapped = withAuth(handler, { roles: ['org_admin'] })
    const req = new NextRequest('http://localhost:3000/api/admin-endpoint')
    const response = await wrapped(req)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.userId).toBe('u-admin-1')
    expect(json.role).toBe('org_admin')
    expect(json.orgId).toBe('org-42')
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
