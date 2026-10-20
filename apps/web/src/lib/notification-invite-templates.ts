import {
  EmailTemplateResult,
  assertNoPiiOrHealthData,
  buildHtmlEmail,
} from './notification-base'

/**
 * Szablon e-mail zaproszenia administratora placówki.
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
 * Szablon e-mail zaproszenia członka rodziny lub opiekuna prawnego.
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
 * Szablon e-mail zaproszenia pracownika personelu opiekuńczego.
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
 * Szablon e-mail resetu hasła.
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
 * Szablon e-mail informujący o cofnięciu dostępu.
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
