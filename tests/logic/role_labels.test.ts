import { describe, it, expect } from 'vitest'
import { ROLES } from '@silvercare/contracts/src/generated/roles'
import { ROLE_LABELS, roleLabel } from '../../apps/web/src/lib/auth/role-labels'
import { ROLE_LABELS as IAM_ROLE_LABELS } from '../../apps/web/src/components/iam/iam-types'
import { ROLE_LABELS as PROFILE_ROLE_LABELS } from '../../apps/web/src/components/profile/profile-types'

/**
 * @REQ: SUP-IAM-PANEL
 * Nazwy ról pochodzą z kontraktu (ROLES.label), decyzja Michała 2026-10-26.
 * Aplikacja ich nie przepisuje: IAM i profil pokazują te same nazwy, bez identyfikatorów w nawiasie.
 */
describe('Nazwy ról z kontraktu (@REQ: SUP-IAM-PANEL)', () => {
  it('@REQ: SUP-IAM-PANEL - nazwy ról to etykiety z kontraktu', () => {
    expect(ROLE_LABELS).toEqual(Object.fromEntries(ROLES.map((r) => [r.id, r.label])))
    expect(ROLE_LABELS).toEqual({
      super_admin: 'Administrator platformy',
      org_admin: 'Kierownik placówki',
      nurse: 'Personel opiekuńczy',
      legal_guardian: 'Opiekun prawny',
      family: 'Członek rodziny',
    })
  })

  it('@REQ: SUP-IAM-PANEL - IAM i profil używają tych samych nazw', () => {
    expect(IAM_ROLE_LABELS).toEqual(ROLE_LABELS)
    expect(PROFILE_ROLE_LABELS).toEqual(ROLE_LABELS)
  })

  it('@REQ: SUP-IAM-PANEL - rola spoza kontraktu nie pokazuje identyfikatora technicznego', () => {
    expect(roleLabel('org_admin')).toBe('Kierownik placówki')
    expect(roleLabel('caregiver')).toBe('Brak roli')
    expect(roleLabel(null)).toBe('Brak roli')
    expect(roleLabel(undefined)).toBe('Brak roli')
  })
})
