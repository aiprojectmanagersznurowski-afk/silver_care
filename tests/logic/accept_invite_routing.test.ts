import { describe, it, expect } from 'vitest'
import {
  resolveAcceptInviteAction,
  validateRedirectUrl,
  type AcceptInviteResolution,
} from '../../apps/web/src/lib/invite-url-helper'

/**
 * @REQ: ADM-INVITE
 * @REQ: FAM-ONBOARDING
 * @REQ: UI-FOUR-STATES
 *
 * Testy logiki routingu i bezpieczeństwa strony akceptacji zaproszenia (/accept-invite).
 */
describe('Bezpieczeństwo i routing /accept-invite (@REQ: ADM-INVITE, @REQ: FAM-ONBOARDING)', () => {
  const CURRENT_ORIGIN = 'https://silvercare.space'

  describe('validateRedirectUrl (@REQ: ADM-INVITE)', () => {
    it('akceptuje zaufane relatywne ścieżki i lokalny origin', () => {
      expect(validateRedirectUrl('/dashboard', CURRENT_ORIGIN)).toBe(true)
      expect(validateRedirectUrl('/login?confirmed=true', CURRENT_ORIGIN)).toBe(true)
      expect(validateRedirectUrl('https://silvercare.space/auth/v1/verify?token=123', CURRENT_ORIGIN)).toBe(true)
    })

    it('akceptuje zaufane domeny Supabase Auth', () => {
      expect(validateRedirectUrl('https://abcxyz.supabase.co/auth/v1/verify?token=123', CURRENT_ORIGIN)).toBe(true)
    })

    it('odrzuca niebezpieczne adresy i próby Open Redirect', () => {
      expect(validateRedirectUrl('javascript:alert(1)', CURRENT_ORIGIN)).toBe(false)
      expect(validateRedirectUrl('https://attacker-phishing.com/steal', CURRENT_ORIGIN)).toBe(false)
      expect(validateRedirectUrl('//malicious.com', CURRENT_ORIGIN)).toBe(false)
      expect(validateRedirectUrl(null, CURRENT_ORIGIN)).toBe(false)
      expect(validateRedirectUrl('', CURRENT_ORIGIN)).toBe(false)
    })
  })

  describe('resolveAcceptInviteAction (@REQ: FAM-ONBOARDING, @REQ: UI-FOUR-STATES)', () => {
    it('przekierowuje token zaproszenia rodziny na /register?token=UUID', () => {
      const res: AcceptInviteResolution = resolveAcceptInviteAction(
        { token: 'd3b07384-d113-4ec6-8968-3e4b37344933' },
        CURRENT_ORIGIN
      )

      expect(res.state).toBe('REDIRECT')
      expect(res.destinationUrl).toBe('/register?token=d3b07384-d113-4ec6-8968-3e4b37344933')
    })

    it('udostępnia akcję akceptacji dla zaufanego linku url personelu/administratora', () => {
      const actionLink = 'https://silvercare.space/auth/v1/verify?token=pkce_abc'
      const res = resolveAcceptInviteAction({ url: actionLink }, CURRENT_ORIGIN)

      expect(res.state).toBe('ACTION_READY')
      expect(res.destinationUrl).toBe(actionLink)
    })

    it('wykrywa niebezpieczny parametr url i zwraca błąd INVALID_URL', () => {
      const res = resolveAcceptInviteAction(
        { url: 'https://evil-hacker.com/login' },
        CURRENT_ORIGIN
      )

      expect(res.state).toBe('ERROR')
      expect(res.errorCode).toBe('INVALID_URL')
    })

    it('wykrywa brak jakichkolwiek parametrów zaproszenia i zwraca stan MISSING_PARAMS', () => {
      const res = resolveAcceptInviteAction({}, CURRENT_ORIGIN)

      expect(res.state).toBe('EMPTY')
      expect(res.errorCode).toBe('MISSING_PARAMS')
    })
  })
})
