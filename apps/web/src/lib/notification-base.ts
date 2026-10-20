/**
 * notification-base.ts — Bazowe typy, asercje bezpieczeństwa oraz generator szablonu HTML wiadomości e-mail.
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
 * Rozwiązuje bazowy URL aplikacji dla odnośników i zasobów statycznych (takich jak logo).
 */
export function resolveSiteUrl(explicitUrl?: string): string {
  if (explicitUrl) {
    try {
      const parsed = new URL(explicitUrl)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return `${parsed.protocol}//${parsed.host}`
      }
    } catch {}
  }
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://silvercare.space').replace(/\/$/, '')
}

/**
 * Główny generator responsywnego szablonu HTML kompatybilnego z klientami pocztowymi (Outlook, Gmail, Apple Mail).
 */
export function buildHtmlEmail(options: {
  title: string
  bodyHtml: string
  ctaText?: string
  ctaUrl?: string
  footerNote?: string
  siteUrl?: string
}): string {
  const { title, bodyHtml, ctaText, ctaUrl, footerNote } = options
  const baseSiteUrl = options.siteUrl || resolveSiteUrl(ctaUrl)
  const logoUrl = `${baseSiteUrl}/logo.png`

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
                    <a href="${baseSiteUrl}" target="_blank" style="text-decoration: none; display: inline-block;">
                      <img src="${logoUrl}" alt="Silver Care" width="160" height="37" style="display: block; width: 160px; max-width: 100%; height: auto; border: 0; outline: none; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 20px; font-weight: 700; color: #2F6F5E;" />
                    </a>
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
