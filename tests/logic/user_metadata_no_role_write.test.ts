import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('../../apps/web/node_modules/next/headers.js', () => ({ cookies: async () => ({ get: () => undefined }) }))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateUserRoleAction } from '../../apps/web/src/actions/iam'
import { executeAdminAssignment } from '../../apps/web/src/lib/org-admin-invite'
import { POST as inviteStaff } from '../../apps/web/src/app/api/staff/invite/route'

/**
 * @REQ: SUP-IAM-PANEL
 * Rola i placówka żyją wyłącznie w app_metadata. user_metadata użytkownik edytuje sam,
 * więc aplikacja nie może tam zapisywać roli ani placówki — ani przy tworzeniu konta, ani przy zmianie roli.
 * Istniejące pola (np. telefon) zostają, stare wpisy role/organization_id są usuwane przy zapisie.
 */
const ORG = '11111111-1111-4111-8111-111111111111'
const STOP = { message: 'stop' }

function expectNoRoleInUserMetadata(payload: { user_metadata?: Record<string, unknown> }) {
  const meta = payload.user_metadata ?? {}
  expect(meta).not.toHaveProperty('role')
  expect(meta).not.toHaveProperty('organization_id')
}

function mockCaller(role: string, orgId?: string) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'caller-1', app_metadata: { role, ...(orgId ? { organization_id: orgId } : {}) } } },
      }),
    },
    rpc: vi.fn().mockResolvedValue({ error: null }),
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

describe('Zapis ról tylko do app_metadata (@REQ: SUP-IAM-PANEL)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('@REQ: SUP-IAM-PANEL - zmiana roli w IAM nie zapisuje roli w user_metadata i usuwa stary wpis', async () => {
    mockCaller('super_admin')
    const updateUserById = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { id: 'u1', app_metadata: { role: 'family', organization_id: ORG }, user_metadata: { role: 'family', organization_id: ORG, phone: '1' } } },
            error: null,
          }),
          updateUserById,
        },
      },
    } as unknown as ReturnType<typeof createAdminClient>)

    const fd = new FormData()
    fd.append('userId', 'u1')
    fd.append('role', 'legal_guardian')
    await updateUserRoleAction(fd)

    expect(updateUserById).toHaveBeenCalledTimes(1)
    const payload = updateUserById.mock.calls[0][1]
    expect(payload.app_metadata.role).toBe('legal_guardian')
    expectNoRoleInUserMetadata(payload)
    if (payload.user_metadata) expect(payload.user_metadata.phone).toBe('1')
  })

  it('@REQ: SUP-IAM-PANEL - nadanie roli kierownika istniejącemu kontu nie zapisuje roli w user_metadata', async () => {
    const updateUserById = vi.fn().mockResolvedValue({ error: STOP })
    const adminClient = { auth: { admin: { updateUserById } } }
    const existing = { id: 'u2', app_metadata: {}, user_metadata: { role: 'nurse', organization_id: ORG, phone: '2' } }

    await executeAdminAssignment({}, adminClient, existing, ORG, 'Placówka', 'a@example.com', 'Anna Nowak', 'caller-1')

    const payload = updateUserById.mock.calls[0][1]
    expect(payload.app_metadata).toMatchObject({ role: 'org_admin', organization_id: ORG })
    expectNoRoleInUserMetadata(payload)
    expect(payload.user_metadata).toMatchObject({ phone: '2', full_name: 'Anna Nowak' })
  })

  it('@REQ: SUP-IAM-PANEL - nowe konto kierownika ma rolę tylko w app_metadata', async () => {
    const createUser = vi.fn().mockResolvedValue({ data: null, error: STOP })
    const adminClient = { auth: { admin: { createUser } } }

    await executeAdminAssignment({}, adminClient, null, ORG, 'Placówka', 'a@example.com', 'Anna Nowak', 'caller-1')

    const payload = createUser.mock.calls[0][0]
    expect(payload.app_metadata).toMatchObject({ role: 'org_admin', organization_id: ORG })
    expectNoRoleInUserMetadata(payload)
  })

  it('@REQ: SUP-IAM-PANEL - zaproszenie personelu tworzy konto z rolą tylko w app_metadata', async () => {
    mockCaller('org_admin', ORG)
    const createUser = vi.fn().mockRejectedValue(new Error('stop'))
    vi.mocked(createAdminClient).mockReturnValue({ auth: { admin: { createUser } } } as unknown as ReturnType<typeof createAdminClient>)

    const req = new Request('http://localhost/api/staff/invite', {
      method: 'POST',
      body: JSON.stringify({ email: 'n@example.com', role: 'nurse', avatar_url: 'https://example.com/a.png' }),
    })
    await inviteStaff(req)

    const payload = createUser.mock.calls[0][0]
    expect(payload.app_metadata).toMatchObject({ role: 'nurse', organization_id: ORG })
    expectNoRoleInUserMetadata(payload)
    expect(payload.user_metadata).toMatchObject({ avatar_url: 'https://example.com/a.png' })
  })
})
