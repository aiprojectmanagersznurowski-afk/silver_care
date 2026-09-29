import { describe, it, expect } from 'vitest'
import {
  renderReportPublishedEmail,
  renderReportPublishedSms,
  renderAdminInviteEmail,
  renderFamilyInviteEmail,
  renderStaffInviteEmail,
  renderPasswordResetEmail,
  renderAccessRevokedEmail,
  assertNoPiiOrHealthData,
} from '../../apps/web/src/lib/notification-templates'

/**
 * @REQ: NTF-REPORT-READY
 * @REQ: NTF-NO-PII
 */
describe('Standardized Notifications (@REQ: NTF-REPORT-READY, @REQ: NTF-NO-PII)', () => {
  const portalUrl = 'https://silvercare.example.com/family/dashboard'
  const inviteUrl = 'https://silvercare.example.com/accept-invite?token=xyz123'
  const resetUrl = 'https://silvercare.example.com/reset-password?token=abc'

  describe('AC1: Ostylowana wiadomość e-mail o publikacji raportu', () => {
    it('generates compliant HTML and plain text for published daily report', () => {
      const email = renderReportPublishedEmail({ portalUrl, organizationName: 'Promienna Jesień' })

      expect(email.subject).toBe('Nowy raport w Silver Care')
      expect(email.text).toContain(portalUrl)
      expect(email.text).toContain('Nowy raport o Twoim bliskim jest dostępny w Silver Care')

      // HTML template verification
      expect(email.html).toContain('<!DOCTYPE html>')
      expect(email.html).toContain('Silver Care')
      expect(email.html).toContain('Zobacz raport w portalu')
      expect(email.html).toContain(portalUrl)
      // Check branding colors (sage green #2F6F5E or #6B8E73)
      expect(email.html.toLowerCase()).toMatch(/#(2f6f5e|6b8e73)/)
      // Check confidentiality footer
      expect(email.html).toContain('Wiadomość wygenerowana automatycznie')
      expect(email.html).toContain('nie zawiera danych medycznych')
    })

    it('strictly satisfies ADR-005, ADR-008 and RODO: zero physiological metrics and no forbidden words', () => {
      const email = renderReportPublishedEmail({ portalUrl })

      // Must pass security assertion
      expect(() => assertNoPiiOrHealthData(email.subject)).not.toThrow()
      expect(() => assertNoPiiOrHealthData(email.text)).not.toThrow()
      expect(() => assertNoPiiOrHealthData(email.html)).not.toThrow()

      const combined = `${email.subject} ${email.text} ${email.html}`.toLowerCase()
      // Forbidden words and medical metrics
      expect(combined).not.toContain('pacjent')
      expect(combined).not.toContain('tętno')
      expect(combined).not.toContain('tetno')
      expect(combined).not.toContain('hrv')
      expect(combined).not.toContain('bpm')
      expect(combined).not.toContain('kroki')
      expect(combined).not.toContain('sen')
      expect(combined).not.toContain('diagnoza')
    })
  })

  describe('AC2: Szablon SMS o publikacji raportu', () => {
    it('generates standard, concise GSM-7 friendly SMS without diacritics', () => {
      const sms = renderReportPublishedSms({ portalUrl: 'https://silvercare.space/login' })

      expect(sms.sender).toBe('SilverCare')
      expect(sms.text).toBe(
        'Dzien dobry. Nowy raport dzienny dla podopiecznego jest gotowy w portalu Silver Care: https://silvercare.space/login'
      )
      // Fits in 1 single SMS standard length (GSM-7 <= 160 characters)
      expect(sms.text.length).toBeLessThanOrEqual(160)

      // Ensure no Polish diacritics that would split SMS into multiple costly segments
      expect(sms.text).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/)

      // Zero health metrics
      expect(() => assertNoPiiOrHealthData(sms.text)).not.toThrow()
    })
  })

  describe('AC3: Szablony zaproszeń i resetu hasła', () => {
    it('renders admin invitation email with organization branding and button', () => {
      const email = renderAdminInviteEmail({
        inviteUrl,
        organizationName: 'Dom Seniora Bursztyn',
      })

      expect(email.subject).toBe('Zaproszenie do zarządzania placówką Dom Seniora Bursztyn w Silver Care')
      expect(email.html).toContain('Dom Seniora Bursztyn')
      expect(email.html).toContain('Aktywuj konto administratora')
      expect(email.html).toContain(inviteUrl)
      expect(email.html).toContain('7 dni')
      expect(email.text).toContain(inviteUrl)
      expect(() => assertNoPiiOrHealthData(email.html)).not.toThrow()
    })

    it('renders family invitation email with friendly greeting and activation link', () => {
      const email = renderFamilyInviteEmail({
        inviteUrl,
        organizationName: 'Dom Seniora Bursztyn',
      })

      expect(email.subject).toBe('Zaproszenie do portalu rodziny Silver Care')
      expect(email.html).toContain('Utwórz konto w portalu')
      expect(email.html).toContain(inviteUrl)
      expect(email.text).toContain(inviteUrl)
      expect(() => assertNoPiiOrHealthData(email.html)).not.toThrow()
    })

    it('renders staff invitation email with proper role title', () => {
      const email = renderStaffInviteEmail({
        inviteUrl,
        organizationName: 'Dom Seniora Bursztyn',
        roleName: 'Pielęgniarka',
      })

      expect(email.subject).toBe('Zaproszenie do personelu placówki w Silver Care')
      expect(email.html).toContain('Dołącz jako: Pielęgniarka')
      expect(email.html).toContain(inviteUrl)
      expect(() => assertNoPiiOrHealthData(email.html)).not.toThrow()
    })

    it('renders password reset email with secure reset link', () => {
      const email = renderPasswordResetEmail({ resetUrl })

      expect(email.subject).toBe('Reset hasła w Silver Care')
      expect(email.html).toContain('Zresetuj hasło')
      expect(email.html).toContain(resetUrl)
      expect(email.text).toContain(resetUrl)
      expect(() => assertNoPiiOrHealthData(email.html)).not.toThrow()
    })

    it('renders access revoked notification email without resident PII', () => {
      const email = renderAccessRevokedEmail({ organizationName: 'Dom Seniora Bursztyn' })

      expect(email.subject).toBe('Informacja o wygaśnięciu dostępu w Silver Care')
      expect(email.html).toContain('Dostęp do portalu rodziny wygasł')
      expect(email.html).toContain('Dom Seniora Bursztyn')
      expect(() => assertNoPiiOrHealthData(email.html)).not.toThrow()
    })
  })

  describe('assertNoPiiOrHealthData validator', () => {
    it('throws error when forbidden medical terms or word "pacjent" are detected', () => {
      expect(() => assertNoPiiOrHealthData('Tętno podopiecznego wynosi 75')).toThrow(/zakazane dane medyczne/)
      expect(() => assertNoPiiOrHealthData('Raport dla pacjenta')).toThrow(/zakazany termin/)
      expect(() => assertNoPiiOrHealthData('Zmienność rytmu zatokowego HRV')).toThrow(/zakazane dane medyczne/)
    })
  })
})
