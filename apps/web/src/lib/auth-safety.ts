/**
 * Bezpieczeństwo ról i uprawnień przy operacjach uwierzytelniania
 * @REQ: ORG-ISOLATION
 * @REQ: CONSENT-GRANTOR
 * @REQ: SUP-IAM-PANEL
 */

export const PROTECTED_STAFF_AND_ADMIN_ROLES = [
  'super_admin',
  'org_admin',
  'nurse',
  'caregiver',
  'doctor',
  'staff',
  'facility_manager',
  'admin',
] as const

export type ProtectedRole = (typeof PROTECTED_STAFF_AND_ADMIN_ROLES)[number]

export interface RoleConflictCheckResult {
  hasConflict: boolean
  reason?: string
}

/**
 * Sprawdza, czy konto logujące się z ciasteczkiem zaproszenia rodziny (invite_token)
 * posiada już istniejącą rolę pracowniczą lub administracyjną.
 * Zapobiega cichemu nadpisaniu uprawnień personelu przez link bliskich.
 */
export function checkOAuthInviteRoleConflict(roles: {
  appRole?: string | null
  userRole?: string | null
}): RoleConflictCheckResult {
  const role = roles.appRole || roles.userRole

  if (!role) {
    return { hasConflict: false }
  }

  const normalizedRole = role.trim().toLowerCase()

  const isProtected = PROTECTED_STAFF_AND_ADMIN_ROLES.some(
    (protectedRole) => protectedRole === normalizedRole
  )

  if (isProtected) {
    return {
      hasConflict: true,
      reason:
        'Konto posiada już uprawnienia personelu placówki lub administratora. Do rejestracji jako bliski użyj dedykowanego konta prywatnego.',
    }
  }

  return { hasConflict: false }
}
