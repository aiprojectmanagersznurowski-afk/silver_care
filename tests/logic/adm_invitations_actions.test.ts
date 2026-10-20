import { describe, it, expect } from 'vitest'
import { formatInviteResponse } from '../../apps/web/src/lib/invite-authorization'
import { resolveAcceptInviteAction, validateRedirectUrl } from '../../apps/web/src/lib/invite-url-helper'

describe('ADM-INVITATIONS-ACTIONS-MANAGEMENT: Rejestr zaproszeń i akcje', () => {
  it('InviteFamilyDialog oraz InvitationsTable są poprawnie eksportowane jako komponenty UI @REQ: ADM-INVITE', async () => {
    const dialogModule = await import('../../apps/web/src/components/InviteFamilyDialog')
    expect(typeof dialogModule.InviteFamilyDialog).toBe('function')

    const tableModule = await import('../../apps/web/src/components/InvitationsTable')
    expect(typeof tableModule.InvitationsTable).toBe('function')
  })

  it('formatInviteResponse w środowisku produkcyjnym nie ujawnia linku rejestracyjnego ani id @REQ: ADM-INVITE', () => {
    const prodRes = formatInviteResponse({
      invitationId: 'inv-uuid-1234',
      registerUrl: 'https://silvercare.space/register?token=inv-uuid-1234',
      isProduction: true,
      emailSent: true,
    })
    expect(prodRes.success).toBe(true)
    expect(prodRes.emailSent).toBe(true)
    expect(prodRes.url).toBeUndefined()
    expect(prodRes.id).toBeUndefined()

    const devRes = formatInviteResponse({
      invitationId: 'inv-uuid-5678',
      registerUrl: 'http://localhost:3000/register?token=inv-uuid-5678',
      isProduction: false,
      emailSent: false,
    })
    expect(devRes.success).toBe(true)
    expect(devRes.emailSent).toBe(false)
    expect(devRes.url).toBe('http://localhost:3000/register?token=inv-uuid-5678')
    expect(devRes.id).toBe('inv-uuid-5678')
  })

  it('resolveAcceptInviteAction poprawnie rozstrzyga token zaproszenia bliskiego @REQ: ADM-INVITE', () => {
    const res = resolveAcceptInviteAction({ token: 'test-token-abc-123' }, 'https://silvercare.space')
    expect(res.state).toBe('REDIRECT')
    expect(res.destinationUrl).toBe('/register?token=test-token-abc-123')
  })

  it('validateRedirectUrl zapobiega atakom Open Redirect na niebezpieczne zewnętrzne domeny @REQ: ADM-INVITE', () => {
    const origin = 'https://silvercare.space'
    expect(validateRedirectUrl('/dashboard', origin)).toBe(true)
    expect(validateRedirectUrl('/staff', origin)).toBe(true)
    expect(validateRedirectUrl('//evil.com', origin)).toBe(false)
    expect(validateRedirectUrl('https://evil.com/phish', origin)).toBe(false)
    expect(validateRedirectUrl('https://silvercare.space/accept-invite', origin)).toBe(true)
  })

  it('resolveAcceptInviteAction obsługuje bezpieczne linki aktywacyjne personelu i odrzuca wrogie adresy @REQ: ADM-INVITE', () => {
    const origin = 'https://silvercare.space'
    const valid = resolveAcceptInviteAction({ url: 'https://silvercare.space/update-password' }, origin)
    expect(valid.state).toBe('ACTION_READY')
    expect(valid.destinationUrl).toBe('https://silvercare.space/update-password')

    const invalid = resolveAcceptInviteAction({ url: 'https://attacker.com/steal' }, origin)
    expect(invalid.state).toBe('ERROR')
    expect(invalid.errorCode).toBe('INVALID_URL')
  })
})
