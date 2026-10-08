import { describe, it, expect, vi, beforeEach } from 'vitest'

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
import { assignAdminToOrganization, findUserByEmailPaginated } from '../../apps/web/src/actions/organizations'
import { checkOAuthInviteRoleConflict } from '../../apps/web/src/lib/auth-safety'

/**
 * @REQ: ORG-ISOLATION
 * @REQ: CONSENT-GRANTOR
 * @REQ: ORG-PROVISION
 * @REQ: SUP-IAM-PANEL
 */
describe('Bezpieczeństwo ról w OAuth Callback i Zarządzaniu Placówką', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('SEC-OAUTH-METADATA-OVERWRITE (@REQ: ORG-ISOLATION, @REQ: CONSENT-GRANTOR)', () => {
    it('blokuje nadpisanie metadanych, gdy zalogowany użytkownik posiada już rolę personelu (np. nurse)', () => {
      // @REQ: ORG-ISOLATION
      const conflict = checkOAuthInviteRoleConflict({
        appRole: 'nurse',
        userRole: undefined,
      })

      expect(conflict.hasConflict).toBe(true)
      expect(conflict.reason).toContain('personelu')
    })

    it('blokuje nadpisanie metadanych dla ról administracyjnych (org_admin, super_admin)', () => {
      // @REQ: SUP-IAM-PANEL
      expect(checkOAuthInviteRoleConflict({ appRole: 'super_admin' }).hasConflict).toBe(true)
      expect(checkOAuthInviteRoleConflict({ appRole: 'org_admin' }).hasConflict).toBe(true)
    })

    it('pozwala na realizację zaproszenia dla nowego konta (brak roli) lub istniejącego konta bliskiego', () => {
      // @REQ: CONSENT-GRANTOR
      expect(checkOAuthInviteRoleConflict({ appRole: null }).hasConflict).toBe(false)
      expect(checkOAuthInviteRoleConflict({ appRole: undefined }).hasConflict).toBe(false)
      expect(checkOAuthInviteRoleConflict({ appRole: 'family' }).hasConflict).toBe(false)
      expect(checkOAuthInviteRoleConflict({ appRole: 'legal_guardian' }).hasConflict).toBe(false)
    })
  })

  describe('ORG-ASSIGN-ADMIN-SAFETY: Paginacja wyszukiwania użytkownika (@REQ: ORG-PROVISION)', () => {
    it('znajduje użytkownika znajdującego się na kolejnej stronie listy użytkowników (paginacja)', async () => {
      // @REQ: ORG-PROVISION
      const mockListUsers = vi.fn().mockImplementation(({ page }) => {
        if (page === 1) {
          // Strona 1: 50 kont innych użytkowników
          const users = Array.from({ length: 50 }, (_, i) => ({
            id: `user-${i}`,
            email: `other${i}@silvercare.test`,
            app_metadata: { role: 'family' },
          }))
          return Promise.resolve({ data: { users, nextPage: 2 }, error: null })
        } else if (page === 2) {
          // Strona 2: docelowy użytkownik
          return Promise.resolve({
            data: {
              users: [
                {
                  id: 'target-user-id',
                  email: 'target.admin@silvercare.test',
                  app_metadata: { role: 'family' },
                },
              ],
              nextPage: null,
            },
            error: null,
          })
        }
        return Promise.resolve({ data: { users: [] }, error: null })
      })

      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: mockListUsers,
          },
        },
      } as any

      const user = await findUserByEmailPaginated(mockAdminClient, 'target.admin@silvercare.test')

      expect(user).toBeDefined()
      expect(user?.id).toBe('target-user-id')
      expect(mockListUsers).toHaveBeenCalledTimes(2)
    })
  })

  describe('ORG-ASSIGN-ADMIN-SAFETY: Ochrona przed degradacją super_admin i personelu (@REQ: SUP-IAM-PANEL)', () => {
    it('bezwzględnie odrzuca próbę przypisania placówki dla konta o roli super_admin', async () => {
      // @REQ: SUP-IAM-PANEL
      // Caller to super_admin
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'super-caller-id',
                app_metadata: { role: 'super_admin' },
              },
            },
          }),
        },
      } as any)

      // Cel to również super_admin
      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: vi.fn().mockResolvedValue({
              data: {
                users: [
                  {
                    id: 'existing-super-admin',
                    email: 'director@silvercare.test',
                    app_metadata: { role: 'super_admin' },
                  },
                ],
              },
              error: null,
            }),
            updateUserById: vi.fn(),
          },
        },
      }

      vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as any)

      const result = await assignAdminToOrganization('org-123', 'director@silvercare.test', 'Dyrektor')

      expect(result).toHaveProperty('error')
      expect(result.error).toContain('super_admin')
      expect(mockAdminClient.auth.admin.updateUserById).not.toHaveBeenCalled()
    })

    it('odrzuca próbę zmiany roli na org_admin dla konta posiadającego aktywną rolę personelu placówki (nurse)', async () => {
      // @REQ: ORG-ISOLATION
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'super-caller-id',
                app_metadata: { role: 'super_admin' },
              },
            },
          }),
        },
      } as any)

      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: vi.fn().mockResolvedValue({
              data: {
                users: [
                  {
                    id: 'nurse-user-id',
                    email: 'nurse@silvercare.test',
                    app_metadata: { role: 'nurse', organization_id: 'org-999' },
                  },
                ],
              },
              error: null,
            }),
            updateUserById: vi.fn(),
          },
        },
      }

      vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as any)

      const result = await assignAdminToOrganization('org-123', 'nurse@silvercare.test', 'Pielęgniarka')

      expect(result).toHaveProperty('error')
      expect(result.error).toContain('personelu')
      expect(mockAdminClient.auth.admin.updateUserById).not.toHaveBeenCalled()
    })
  })
})
