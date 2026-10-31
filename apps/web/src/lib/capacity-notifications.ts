import { NOTIFICATIONS } from '@silvercare/contracts/src/generated/notifications'
import { CAPACITY_POLICY } from '@silvercare/contracts/src/generated/facility'
import { assertNoPiiOrHealthData, buildHtmlEmail, EmailTemplateResult } from './notification-base'

/**
 * Powiadomienia A4 (kierownik placówki) i A5 (super admin) o przekroczeniu limitu miejsc
 * (ADM-CAPACITY-LIMIT, SC-ADM-22/AC4). Odbiorcy z katalogu powiadomień, rola wyłącznie z app_metadata.
 * Treść zawiera tylko liczby i nazwę placówki — bez danych podopiecznych (NTF-NO-PII).
 */
export type CapacityNotificationId = (typeof CAPACITY_POLICY.onExceed.notify)[number]

interface RecipientCandidate {
  email?: string | null
  app_metadata?: Record<string, unknown> | null
}

export function selectCapacityRecipients(
  users: RecipientCandidate[],
  target: { notificationId: CapacityNotificationId; organizationId: string }
): string[] {
  const entry = NOTIFICATIONS.find((n) => n.id === target.notificationId)
  if (!entry || !(CAPACITY_POLICY.onExceed.notify as readonly string[]).includes(target.notificationId)) {
    throw new Error(`Nieznane powiadomienie o limicie miejsc: ${target.notificationId}`)
  }

  return users
    .filter((u) => {
      const meta = (u.app_metadata || {}) as { role?: string; organization_id?: string }
      if (!u.email || !u.email.includes('@')) return false
      if (entry.recipient === 'SUPER_ADMIN') return meta.role === 'super_admin'
      return meta.role === 'org_admin' && meta.organization_id === target.organizationId
    })
    .map((u) => u.email as string)
}

export function renderCapacityExceededEmail(params: {
  notificationId: CapacityNotificationId
  residentLimit: number
  projected: number
  excess: number
  counts: 'beds' | 'residents'
  portalUrl: string
  organizationName?: string
}): EmailTemplateResult {
  const what = params.counts === 'beds' ? 'łóżek' : 'podopiecznych'
  const where = params.organizationName ? `Placówka ${params.organizationName}` : 'Placówka'
  const facts = `${where} ma ${params.projected} ${what} przy limicie miejsc ${params.residentLimit} (o ${params.excess} więcej).`

  const forManager = params.notificationId === 'A4'
  const subject = forManager
    ? 'Twoja placówka przekroczyła limit miejsc'
    : `${where} przekroczyła limit miejsc ustalony na platformie`
  const follow = forManager
    ? 'Przekroczenie zostało zatwierdzone przez kierownika placówki i odnotowane w rejestrze audytowym. Limit miejsc ustala Administrator platformy.'
    : 'Kierownik placówki zatwierdził operację ponad ustalony limit. Limit możesz zmienić w panelu placówek.'

  const text = `Dzień dobry,\n\n${facts}\n\n${follow}\n\n${params.portalUrl}\n\n---\nWiadomość wygenerowana automatycznie przez system Silver Care. Nie zawiera danych podopiecznych.`
  const html = buildHtmlEmail({
    title: 'Przekroczenie limitu miejsc',
    bodyHtml: `<p style="margin: 0 0 14px 0;">Dzień dobry,</p><p style="margin: 0 0 14px 0;">${facts}</p><p style="margin: 0 0 14px 0;">${follow}</p>`,
    ctaText: 'Otwórz panel',
    ctaUrl: params.portalUrl,
  })

  assertNoPiiOrHealthData(subject)
  assertNoPiiOrHealthData(text)
  assertNoPiiOrHealthData(html)
  return { subject, html, text }
}
