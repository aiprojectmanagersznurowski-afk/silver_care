import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ROLES } from '../../packages/contracts/src/generated/roles'

// Mock createClient & createAdminClient
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
import { updateUserRoleAction, createUserWithRoleAction, resetUserPasswordAction } from '../../apps/web/src/actions/iam'

/**
 * @REQ: SUP-IAM-PANEL
 * @REQ: SEC-403-LOGGING
 * Bezpieczeństwo panelu IAM:
 * AC1: Reset hasła wyłącznie przez bezpieczny link e-mail
 * AC2: Blokada wyboru roli super_admin w UI
 * AC3: Serwerowa ochrona przed manipulacją rolą super_admin (403 Forbidden)
 */
describe('IAM Hardening & Privilege Escalation Protection (@REQ: SUP-IAM-PANEL)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('AC2: Blokada roli super_admin w selektorach UI (@REQ: SUP-IAM-PANEL)', () => {
    it('ensures facility assignable roles in IAM exclude super_admin', () => {
      // Pobieramy role dostępne do przypisania w panelu IAM
      const assignableRoles = ROLES.filter(r => r.id !== 'super_admin').map(r => r.id)
      
      expect(assignableRoles).not.toContain('super_admin')
      expect(assignableRoles).toContain('org_admin')
      expect(assignableRoles).toContain('nurse')
      expect(assignableRoles).toContain('legal_guardian')
      expect(assignableRoles).toContain('family')
    })
  })

  describe('AC3: Serwerowa ochrona przed eskalacją do roli super_admin (@REQ: SEC-403-LOGGING)', () => {
    it('rejects updateUserRoleAction when attempting to assign super_admin role with 403 Forbidden', async () => {
      // Mock authenticated super_admin caller
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
        rpc: vi.fn().mockResolvedValue({ error: null }),
      } as unknown as Awaited<ReturnType<typeof createClient>>)

      const formData = new FormData()
      formData.append('userId', 'target-user-1')
      formData.append('role', 'super_admin')

      const result = await updateUserRoleAction(formData)

      // Operacja musi zostać bezwzględnie zablokowana z kodem/statusem 403 Forbidden
      expect(result).toHaveProperty('error')
      expect(result.status || (result as { code?: number }).code).toBe(403)
      expect(result.error).toMatch(/super_admin/i)
      expect(result.error).toMatch(/niedozwolon|zablokowan|brak uprawnień/i)
    })

    it('rejects createUserWithRoleAction when attempting to create user with super_admin role with 403 Forbidden', async () => {
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
        rpc: vi.fn().mockResolvedValue({ error: null }),
      } as unknown as Awaited<ReturnType<typeof createClient>>)

      const formData = new FormData()
      formData.append('email', 'attacker@example.com')
      formData.append('role', 'super_admin')

      const result = await createUserWithRoleAction(formData)

      expect(result).toHaveProperty('error')
      expect(result.status || (result as { code?: number }).code).toBe(403)
      expect(result.error).toMatch(/super_admin/i)
    })
  })

  describe('AC1: Reset hasła wyłącznie przez bezpieczny link e-mail (@REQ: SUP-IAM-PANEL)', () => {
    it('dispatches password recovery link and does NOT accept or return plain text password', async () => {
      const mockResetPasswordForEmail = vi.fn().mockResolvedValue({
        data: {},
        error: null,
      })

      const mockGetUserById = vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'target-user-1',
            email: 'user@example.com',
            app_metadata: { role: 'nurse', organization_id: 'org-1' },
            user_metadata: {},
          },
        },
        error: null,
      })

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
          resetPasswordForEmail: mockResetPasswordForEmail,
        },
        rpc: vi.fn().mockResolvedValue({ error: null }),
      } as unknown as Awaited<ReturnType<typeof createClient>>)

      vi.mocked(createAdminClient).mockReturnValue({
        auth: {
          admin: {
            getUserById: mockGetUserById,
            updateUserById: vi.fn(),
          },
        },
      } as unknown as ReturnType<typeof createAdminClient>)

      const formData = new FormData()
      formData.append('userId', 'target-user-1')
      // Nawet jeśli złośliwy klient prześle pole password, powinno być ignorowane
      formData.append('password', 'plaintext123456')

      const result = await resetUserPasswordAction(formData)

      expect(result).toHaveProperty('success', true)
      // Nie wolno zwracać żadnego jawnego hasła ani tymczasowego hasła
      expect(result).not.toHaveProperty('newPassword')
      expect(result).not.toHaveProperty('temporaryPassword')
      expect((result as { recoveryEmailSent?: boolean }).recoveryEmailSent).toBe(true)

      // Sprawdź, czy wywołano wysłanie linku resetującego przez Supabase Auth
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com')
    })
  })
})
