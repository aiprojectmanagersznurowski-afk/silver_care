/**
 * notification-templates.ts — Standaryzowane szablony powiadomień E-mail (HTML + Plain Text) oraz SMS.
 *
 * Zgodność z regułami architektonicznymi:
 * - ADR-004: Bezwzględny zakaz używania zakazanego terminu opieki w warstwie użytkownika.
 * - ADR-005: Jedynym wyzwalaczem jest publikacja raportu. Zakaz jakichkolwiek metryk fizjologicznych (tętno, HRV, sen, kroki).
 * - ADR-008: Zero danych osobowych (PII) w powiadomieniach (brak imion, nazwisk, PESEL).
 * - ADR-011: Identyfikacja wizualna Silver Care — szałwiowa zieleń (#2F6F5E / #6B8E73), ciepłe tło (#FBFAF8), Apple typography.
 *
 * @REQ: NTF-REPORT-READY
 * @REQ: NTF-NO-PII
 */

import {
  EmailTemplateResult,
  SmsTemplateResult,
  assertNoPiiOrHealthData,
  buildHtmlEmail,
} from './notification-base'

export type { EmailTemplateResult, SmsTemplateResult }
export { assertNoPiiOrHealthData }

export {
  renderAdminInviteEmail,
  renderFamilyInviteEmail,
  renderStaffInviteEmail,
  renderPasswordResetEmail,
  renderAccessRevokedEmail,
} from './notification-invite-templates'

/**
 * AC1: Szablon e-mail o publikacji raportu dziennego dla rodziny.
 */
export function renderReportPublishedEmail(params: {
  portalUrl: string
  organizationName?: string
}): EmailTemplateResult {
  const { portalUrl, organizationName } = params
  const orgText = organizationName ? ` w placówce ${organizationName}` : ''

  const subject = 'Nowy raport w Silver Care'
  const bodyHtml = `
    <p style="margin: 0 0 14px 0;">Dzień dobry,</p>
    <p style="margin: 0 0 14px 0;">
      Personel opiekuńczy przygotował i opublikował nowy raport dzienny dotyczący Twojego bliskiego${orgText}.
    </p>
    <p style="margin: 0 0 14px 0;">
      Raport podsumowuje aktywność, samopoczucie oraz przebieg dnia. Jest dostępny po bezpiecznym zalogowaniu się do Portalu Rodziny.
    </p>
  `

  const text = `Dzień dobry,\n\nNowy raport o Twoim bliskim jest dostępny w Silver Care${orgText}.\n\nAby go zobaczyć, zaloguj się w portalu:\n${portalUrl}\n\n---\nWiadomość wygenerowana automatycznie przez system Silver Care. Ze względów bezpieczeństwa nie zawiera danych medycznych.`

  const html = buildHtmlEmail({
    title: 'Nowy raport dzienny jest gotowy',
    bodyHtml,
    ctaText: 'Zobacz raport w portalu',
    ctaUrl: portalUrl,
    footerNote: organizationName ? `Placówka opiekuńcza: ${organizationName}` : undefined,
  })

  assertNoPiiOrHealthData(subject)
  assertNoPiiOrHealthData(text)
  assertNoPiiOrHealthData(html)

  return { subject, html, text }
}

/**
 * AC2: Szablon SMS o publikacji raportu dziennego dla rodziny.
 * Krótki komunikat bez znaków diakrytycznych (kodowanie GSM-7) dla gwarancji 1 standardowego SMS.
 */
export function renderReportPublishedSms(params: { portalUrl: string }): SmsTemplateResult {
  const { portalUrl } = params
  const text = `Dzien dobry. Nowy raport dzienny dla podopiecznego jest gotowy w portalu Silver Care: ${portalUrl}`

  assertNoPiiOrHealthData(text)

  return {
    sender: 'SilverCare',
    text,
  }
}
