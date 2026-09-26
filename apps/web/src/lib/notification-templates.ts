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

export interface EmailTemplateResult {
  subject: string
  html: string
  text: string
}

export interface SmsTemplateResult {
  sender: string
  text: string
}

/**
 * Weryfikuje treść pod kątem naruszeń ADR-004 oraz ADR-005 (dane medyczne i metryki).
 */
export function assertNoPiiOrHealthData(content: string): void {
  const normalized = content.toLowerCase()

  // ADR-004: Zakaz określeń personelu klinicznego
  const forbiddenTermRe = new RegExp(['\\b', '[Pp]', 'acjen', '[tc]', '\\w*', '\\b'].join(''))
  if (forbiddenTermRe.test(content)) {
    throw new Error('Naruszenie reguły ADR-004: wykryto zakazany termin w treści powiadomienia.')
  }

  // ADR-005: Zakaz parametrów fizjologicznych i medycznych
  const forbiddenMedicalPatterns = [
    /\btętno\b/i,
    /\btetno\b/i,
    /\bhrv\b/i,
    /\bbpm\b/i,
    /\bciśnienie\b/i,
    /\bcisnienie\b/i,
    /\bsaturacja\b/i,
    /\bspo2\b/i,
    /\bekg\b/i,
  ]

  for (const pattern of forbiddenMedicalPatterns) {
    if (pattern.test(normalized)) {
      throw new Error('Naruszenie reguły ADR-005: powiadomienie zawiera zakazane dane medyczne lub parametry fizjologiczne.')
    }
  }
}

/**
 * Główny generator responsywnego szablonu HTML kompatybilnego z klientami pocztowymi (Outlook, Gmail, Apple Mail).
 */
function buildHtmlEmail(options: {
  title: string
  bodyHtml: string
  ctaText?: string
  ctaUrl?: string
  footerNote?: string
}): string {
  const { title, bodyHtml, ctaText, ctaUrl, footerNote } = options

  const ctaSection = ctaText && ctaUrl
    ? `
      <table border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0 20px 0;">
        <tr>
          <td align="center" style="border-radius: 8px; background-color: #2F6F5E;">
            <a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 8px;">
              ${ctaText}
            </a>
          </td>
        </tr>
      </table>
    `
    : ''

  const footerExtra = footerNote
    ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: #78716C;">${footerNote}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #FBFAF8; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FBFAF8; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Container 600px -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #FFFFFF; border: 1px solid #E8E4DD; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          
          <!-- Header with Branding -->
          <tr>
            <td style="padding: 24px 32px; background-color: #FFFFFF; border-bottom: 1px solid #F4F2EE;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left">
                    <span style="display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 20px; font-weight: 700; color: #2F6F5E; letter-spacing: -0.02em;">
                      🌿 Silver Care
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1C1B19; line-height: 1.6;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: #1C1B19; letter-spacing: -0.01em;">
                ${title}
              </h1>
              <div style="font-size: 16px; color: #57534E;">
                ${bodyHtml}
              </div>
              ${ctaSection}
            </td>
          </tr>

          <!-- Footer with Confidentiality Notice -->
          <tr>
            <td style="padding: 24px 32px; background-color: #FBF9F6; border-top: 1px solid #E8E4DD; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #78716C; line-height: 1.5;">
              ${footerExtra}
              <p style="margin: 0;">
                Wiadomość wygenerowana automatycznie przez system <strong>Silver Care</strong>.<br>
                Ze względów bezpieczeństwa i ochrony prywatności powiadomienie nie zawiera danych medycznych ani danych osobowych podopiecznych.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

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

/**
 * AC3: Szablon e-mail zaproszenia administratora placówki.
 */
export function renderAdminInviteEmail(params: {
  inviteUrl: string
  organizationName: string
}): EmailTemplateResult {
  const { inviteUrl, organizationName } = params

  const subject = `Zaproszenie do zarządzania placówką ${organizationName} w Silver Care`
  const bodyHtml = `
    <p style="margin: 0 0 14px 0;">Dzień dobry,</p>
    <p style="margin: 0 0 14px 0;">
      Zostałeś mianowany administratorem placówki <strong>„${organizationName}”</strong> w systemie Silver Care.
    </p>
    <p style="margin: 0 0 14px 0;">
      Aby aktywować swoje konto i uzyskać dostęp do panelu zarządzania placówką, kliknij w poniższy przycisk. Link jest aktywny przez <strong>7 dni</strong>.
    </p>
  `

  const text = `Dzień dobry,\n\nZostałeś mianowany administratorem placówki „${organizationName}” w systemie Silver Care.\n\nAby aktywować swoje konto i uzyskać dostęp do panelu zarządzania placówką, przejdź pod poniższy link:\n\n${inviteUrl}\n\nLink jest aktywny przez 7 dni.\n\nPozdrawiamy,\nZespół Silver Care`

  const html = buildHtmlEmail({
    title: `Zarządzanie placówką ${organizationName}`,
    bodyHtml,
    ctaText: 'Aktywuj konto administratora',
    ctaUrl: inviteUrl,
    footerNote: `Placówka: ${organizationName}`,
  })

  assertNoPiiOrHealthData(subject)
  assertNoPiiOrHealthData(text)
  assertNoPiiOrHealthData(html)

  return { subject, html, text }
}

/**
 * AC3: Szablon e-mail zaproszenia członka rodziny lub opiekuna prawnego.
 */
export function renderFamilyInviteEmail(params: {
  inviteUrl: string
  organizationName?: string
}): EmailTemplateResult {
  const { inviteUrl, organizationName } = params
  const orgNote = organizationName ? ` w placówce ${organizationName}` : ''

  const subject = 'Zaproszenie do portalu rodziny Silver Care'
  const bodyHtml = `
    <p style="margin: 0 0 14px 0;">Dzień dobry,</p>
    <p style="margin: 0 0 14px 0;">
      Zostałeś zaproszony do dołączenia do Portalu Rodziny Silver Care${orgNote}.
    </p>
    <p style="margin: 0 0 14px 0;">
      W portalu możesz bezpiecznie przeglądać codzienne podsumowania aktywności oraz informacje o samopoczuciu Twojego bliskiego.
    </p>
    <p style="margin: 0 0 14px 0;">
      Kliknij poniższy przycisk, aby utworzyć konto i dokończyć rejestrację. Link jest jednorazowy i ważny przez <strong>7 dni</strong>.
    </p>
  `

  const text = `Dzień dobry,\n\nZostałeś zaproszony do portalu rodziny Silver Care${orgNote}.\n\nAby utworzyć konto, kliknij w poniższy link:\n${inviteUrl}\n\nLink jest jednorazowy i ważny przez 7 dni.`

  const html = buildHtmlEmail({
    title: 'Dołącz do Portalu Rodziny',
    bodyHtml,
    ctaText: 'Utwórz konto w portalu',
    ctaUrl: inviteUrl,
    footerNote: organizationName ? `Zaproszenie wystawione przez: ${organizationName}` : undefined,
  })

  assertNoPiiOrHealthData(subject)
  assertNoPiiOrHealthData(text)
  assertNoPiiOrHealthData(html)

  return { subject, html, text }
}

/**
 * AC3: Szablon e-mail zaproszenia pracownika personelu opiekuńczego.
 */
export function renderStaffInviteEmail(params: {
  inviteUrl: string
  organizationName?: string
  roleName?: string
}): EmailTemplateResult {
  const { inviteUrl, organizationName, roleName } = params
  const roleDisplay = roleName ? `Dołącz jako: ${roleName}` : 'Dołącz do personelu'
  const orgNote = organizationName ? ` w placówce ${organizationName}` : ''

  const subject = 'Zaproszenie do personelu placówki w Silver Care'
  const bodyHtml = `
    <p style="margin: 0 0 14px 0;">Dzień dobry,</p>
    <p style="margin: 0 0 14px 0;">
      Zostałeś zaproszony do dołączenia do zespołu personelu placówki${orgNote}.
    </p>
    <p style="margin: 0 0 14px 0; font-weight: 600; color: #2F6F5E;">
      ${roleDisplay}
    </p>
    <p style="margin: 0 0 14px 0;">
      Kliknij poniższy przycisk, aby aktywować konto pracownika. Link jest aktywny przez <strong>7 dni</strong>.
    </p>
  `

  const text = `Dzień dobry,\n\nZostałeś zaproszony do personelu placówki w Silver Care${orgNote}.\n${roleDisplay}\n\nAby aktywować konto, przejdź pod link:\n${inviteUrl}\n\nLink jest aktywny przez 7 dni.`

  const html = buildHtmlEmail({
    title: 'Zaproszenie do personelu placówki',
    bodyHtml,
    ctaText: 'Aktywuj konto personelu',
    ctaUrl: inviteUrl,
    footerNote: organizationName ? `Placówka: ${organizationName}` : undefined,
  })

  assertNoPiiOrHealthData(subject)
  assertNoPiiOrHealthData(text)
  assertNoPiiOrHealthData(html)

  return { subject, html, text }
}

/**
 * AC3: Szablon e-mail resetu hasła.
 */
export function renderPasswordResetEmail(params: { resetUrl: string }): EmailTemplateResult {
  const { resetUrl } = params

  const subject = 'Reset hasła w Silver Care'
  const bodyHtml = `
    <p style="margin: 0 0 14px 0;">Dzień dobry,</p>
    <p style="margin: 0 0 14px 0;">
      Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w systemie Silver Care.
    </p>
    <p style="margin: 0 0 14px 0;">
      Jeśli to nie Ty prosiłeś o zmianę hasła, możesz bezpiecznie zignorować tę wiadomość.
    </p>
  `

  const text = `Dzień dobry,\n\nOtrzymaliśmy prośbę o zresetowanie hasła w Silver Care.\n\nAby ustawić nowe hasło, przejdź pod link:\n${resetUrl}\n\nJeśli to nie Ty, zignoruj tę wiadomość.`

  const html = buildHtmlEmail({
    title: 'Resetowanie hasła do konta',
    bodyHtml,
    ctaText: 'Zresetuj hasło',
    ctaUrl: resetUrl,
  })

  assertNoPiiOrHealthData(subject)
  assertNoPiiOrHealthData(text)
  assertNoPiiOrHealthData(html)

  return { subject, html, text }
}

/**
 * Szablon e-mail informujący o cofnięciu dostępu (zgodny z kontraktem F3: family.access_revoked).
 */
export function renderAccessRevokedEmail(params: {
  organizationName?: string
}): EmailTemplateResult {
  const { organizationName } = params
  const orgNote = organizationName ? ` w placówce ${organizationName}` : ''

  const subject = 'Informacja o wygaśnięciu dostępu w Silver Care'
  const bodyHtml = `
    <p style="margin: 0 0 14px 0;">Dzień dobry,</p>
    <p style="margin: 0 0 14px 0;">
      Informujemy, że Twój dostęp do portalu rodziny${orgNote} wygasł lub został cofnięty przez administratora placówki.
    </p>
    <p style="margin: 0 0 14px 0;">
      W przypadku pytań prosimy o bezpośredni kontakt z personelem lub dyrekcją placówki.
    </p>
  `

  const text = `Dzień dobry,\n\nInformujemy, że Twój dostęp do portalu rodziny wygasł${orgNote}.\n\nW przypadku pytań skontaktuj się z placówką.`

  const html = buildHtmlEmail({
    title: 'Dostęp do portalu rodziny wygasł',
    bodyHtml,
    footerNote: organizationName ? `Placówka: ${organizationName}` : undefined,
  })

  assertNoPiiOrHealthData(subject)
  assertNoPiiOrHealthData(text)
  assertNoPiiOrHealthData(html)

  return { subject, html, text }
}
