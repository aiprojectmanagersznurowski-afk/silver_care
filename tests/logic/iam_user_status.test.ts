import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { manageUserStatusAction } from '../../apps/web/src/actions/iam'

/**
 * @REQ: SUP-IAM-PANEL
 * @REQ: SEC-403-LOGGING
 * @REQ: SEC-NO-PII-LOGS
 *
 * Testy zarządzania statusem i usuwania kont w panelu IAM przez superadmina:
 * AC1: Blokada modyfikacji/usunięcia własnego konta przez superadmina
 * AC2: Ochrona uprawnień — odrzucenie wywołań od użytkowników bez roli super_admin (403 Forbidden)
 * AC3: Bezpieczna blokada / soft-delete (deaktywacja konta i rejestracja w audit_logs)
 * AC4: Trwałe usunięcie konta (hard-delete z bazy Auth)
 * AC5: Odblokowanie / reaktywacja konta
 */
describe('IAM User Status & Deletion Management (@REQ: SUP-IAM-PANEL, @REQ: SEC-403-LOGGING)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated or non-superadmin users with 403 status @REQ: SEC-403-LOGGING', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'org-admin-1',
              app_metadata: { role: 'org_admin' },
            },
          },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const formData = new FormData()
    formData.set('userId', 'target-user-1')
    formData.set('mode', 'deactivate')

    const result = await manageUserStatusAction(formData)
    expect(result.status).toBe(403)
    expect(result.error).toContain('Wymagana rola super_admin')
  })

  it('prevents super_admin from deactivating or deleting their own account @REQ: SUP-IAM-PANEL', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'super-admin-self',
              app_metadata: { role: 'super_admin' },
            },
          },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const formData = new FormData()
    formData.set('userId', 'super-admin-self')
    formData.set('mode', 'deactivate')

    const result = await manageUserStatusAction(formData)
    expect(result.status).toBe(403)
    expect(result.error).toContain('Nie możesz usunąć ani zablokować własnego konta')
  })

  it('successfully deactivates user (soft-delete / ban) and logs audit entry without PII @REQ: SUP-IAM-PANEL, @REQ: SEC-NO-PII-LOGS', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockAdminClient = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'target-user-1',
                email: 'test@silvercare.pl',
                app_metadata: { role: 'nurse', organization_id: 'org-1' },
              },
            },
            error: null,
          }),
          updateUserById: vi.fn().mockResolvedValue({ error: null }),
        },
      },
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    }

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'super-admin-1',
              app_metadata: { role: 'super_admin' },
            },
          },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as unknown as ReturnType<typeof createAdminClient>)

    const formData = new FormData()
    formData.set('userId', 'target-user-1')
    formData.set('mode', 'deactivate')

    const result = await manageUserStatusAction(formData)
    expect(result.success).toBe(true)
    expect(mockAdminClient.auth.admin.updateUserById).toHaveBeenCalledWith(
      'target-user-1',
      expect.objectContaining({
        ban_duration: '87600h',
        app_metadata: expect.objectContaining({ is_active: false }),
      })
    )
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_DEACTIVATED',
        performed_by: 'super-admin-1',
        payload: expect.objectContaining({
          target_user_id: 'target-user-1',
          mode: 'deactivate',
        }),
      })
    )
    // Brak danych osobowych (PII) w audycie
    const insertPayload = mockInsert.mock.calls[0][0].payload
    expect(insertPayload.email).toBeUndefined()
  })

  it('successfully hard-deletes user account and logs audit entry @REQ: SUP-IAM-PANEL', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockAdminClient = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'test-user-to-delete',
                email: 'test.del@silvercare.pl',
                app_metadata: { role: 'family', organization_id: 'org-2' },
              },
            },
            error: null,
          }),
          deleteUser: vi.fn().mockResolvedValue({ error: null }),
        },
      },
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    }

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'super-admin-1',
              app_metadata: { role: 'super_admin' },
            },
          },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as unknown as ReturnType<typeof createAdminClient>)

    const formData = new FormData()
    formData.set('userId', 'test-user-to-delete')
    formData.set('mode', 'hard_delete')

    const result = await manageUserStatusAction(formData)
    expect(result.success).toBe(true)
    expect(mockAdminClient.auth.admin.deleteUser).toHaveBeenCalledWith('test-user-to-delete')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_HARD_DELETED',
        performed_by: 'super-admin-1',
      })
    )
  })

  it('successfully reactivates deactivated user @REQ: SUP-IAM-PANEL', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockAdminClient = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'deactivated-user-1',
                email: 'deact@silvercare.pl',
                app_metadata: { role: 'nurse', is_active: false, organization_id: 'org-1' },
              },
            },
            error: null,
          }),
          updateUserById: vi.fn().mockResolvedValue({ error: null }),
        },
      },
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    }

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'super-admin-1',
              app_metadata: { role: 'super_admin' },
            },
          },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as unknown as ReturnType<typeof createAdminClient>)

    const formData = new FormData()
    formData.set('userId', 'deactivated-user-1')
    formData.set('mode', 'activate')

    const result = await manageUserStatusAction(formData)
    expect(result.success).toBe(true)
    expect(mockAdminClient.auth.admin.updateUserById).toHaveBeenCalledWith(
      'deactivated-user-1',
      expect.objectContaining({
        ban_duration: 'none',
        app_metadata: expect.objectContaining({ is_active: true }),
      })
    )
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_ACTIVATED',
      })
    )
  })
})
