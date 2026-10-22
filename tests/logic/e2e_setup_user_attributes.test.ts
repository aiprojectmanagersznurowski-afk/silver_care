import { describe, it, expect } from 'vitest'
import {
  buildExistingUserUpdate,
  buildNewUserCreate,
  buildTestUsers,
} from '../../scripts/lib/e2e-user-attributes.mjs'

/**
 * global-setup E2E przygotowuje konta testowe przed każdym przebiegiem. Test
 * staff-account-actions.spec.ts zawiesza konto e2e.nurse (ban w Supabase) i go nie
 * przywraca, więc setup musi zdejmować blokadę, inaczej kolejny przebieg zaczyna się
 * od konta, które nie może się zalogować.
 */
const CONFIG = { email: 'e2e.nurse@silvercare.test', role: 'nurse', organization_id: 'org-1' }

describe('E2E setup — atrybuty kont testowych (@REQ: ORG-ISOLATION)', () => {
  it('przy aktualizacji istniejącego konta zdejmuje blokadę (ban_duration: none) @REQ: ORG-ISOLATION', () => {
    const update = buildExistingUserUpdate('haslo-testowe', CONFIG)
    expect(update.ban_duration).toBe('none')
  })

  it('przy aktualizacji ustawia hasło, potwierdza e-mail i metadane roli @REQ: ORG-ISOLATION', () => {
    const update = buildExistingUserUpdate('haslo-testowe', CONFIG)
    expect(update.password).toBe('haslo-testowe')
    expect(update.email_confirm).toBe(true)
    expect(update.app_metadata).toEqual({ role: 'nurse', organization_id: 'org-1' })
  })

  it('przy tworzeniu nowego konta zachowuje e-mail, hasło i metadane roli @REQ: ORG-ISOLATION', () => {
    const create = buildNewUserCreate('haslo-testowe', CONFIG)
    expect(create.email).toBe('e2e.nurse@silvercare.test')
    expect(create.password).toBe('haslo-testowe')
    expect(create.email_confirm).toBe(true)
    expect(create.app_metadata).toEqual({ role: 'nurse', organization_id: 'org-1' })
  })

  it('nie ustawia blokady przy tworzeniu nowego konta @REQ: ORG-ISOLATION', () => {
    const create = buildNewUserCreate('haslo-testowe', CONFIG)
    expect(create).not.toHaveProperty('ban_duration')
  })

  it('konto super_admin nie należy do żadnej placówki (rola globalna wg roles.contract) @REQ: ORG-ISOLATION', () => {
    const users = buildTestUsers('org-1')
    expect(users.super_admin.role).toBe('super_admin')
    expect(users.super_admin.organization_id).toBeUndefined()
  })

  it('pozostałe role testowe zachowują placówkę @REQ: ORG-ISOLATION', () => {
    const users = buildTestUsers('org-1')
    expect(users.org_admin.organization_id).toBe('org-1')
    expect(users.nurse.organization_id).toBe('org-1')
    expect(users.family.organization_id).toBe('org-1')
  })

  it('aktualizacja konta globalnego usuwa stary claim placówki (null) @REQ: ORG-ISOLATION', () => {
    const update = buildExistingUserUpdate('haslo-testowe', buildTestUsers('org-1').super_admin)
    expect(update.app_metadata).toEqual({ role: 'super_admin', organization_id: null })
  })

  it('utworzenie konta globalnego nie ustawia claimu placówki @REQ: ORG-ISOLATION', () => {
    const create = buildNewUserCreate('haslo-testowe', buildTestUsers('org-1').super_admin)
    expect(create.app_metadata).toEqual({ role: 'super_admin' })
  })
})
