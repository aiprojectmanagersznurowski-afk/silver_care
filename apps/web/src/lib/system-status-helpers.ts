import { FORBIDDEN_UI_TERMS } from '@silvercare/contracts/src/generated/presentation'

export type SystemAlertSeverity = 'info' | 'warning' | 'error'
export type SystemAlertStatus = 'operational' | 'degraded' | 'maintenance'
export type SystemServiceId = 'voice_pipeline' | 'wearables' | 'notifications' | 'platform'

export interface SystemServiceDefinition {
  id: SystemServiceId
  label: string
  description: string
}

export const SYSTEM_SERVICES: readonly SystemServiceDefinition[] = [
  {
    id: 'voice_pipeline',
    label: 'Potok głosowy (AI)',
    description: 'Transkrypcja notatek głosowych i generowanie wersji roboczych raportów',
  },
  {
    id: 'wearables',
    label: 'Synchronizacja opasek',
    description: 'Pobieranie danych o krokach, aktywności i śnie z urządzeń zewnętrznych',
  },
  {
    id: 'notifications',
    label: 'Powiadomienia SMS / E-mail',
    description: 'Wysyłka powiadomień o opublikowanych raportach i zaproszeniach',
  },
  {
    id: 'platform',
    label: 'Portal i baza danych',
    description: 'Główne moduły operacyjne placówki oraz Portal Rodziny',
  },
] as const

export interface SystemAlertRecord {
  id: string
  title: string
  message: string
  severity: SystemAlertSeverity
  status: SystemAlertStatus
  affected_services: string[]
  is_active: boolean
  created_at: string
  updated_at?: string
  resolved_at?: string | null
  /** Opcjonalny termin wygaśnięcia; po nim alert ma status „Wygasł”. */
  expires_at?: string | null
}

export interface SystemAlertInput {
  title: string
  message: string
  severity: SystemAlertSeverity
  status: SystemAlertStatus
  affectedServices: string[]
  /** ISO 8601; puste = alert do ręcznego zakończenia */
  expiresAt?: string | null
}

export interface ActiveSystemBannerState {
  id: string
  title: string
  message: string
  severity: SystemAlertSeverity
  status: SystemAlertStatus
  affectedServices: string[]
  serviceLabels: string[]
  createdAt: string
}

const VALID_SEVERITIES: readonly SystemAlertSeverity[] = ['info', 'warning', 'error']
const VALID_STATUSES: readonly SystemAlertStatus[] = ['operational', 'degraded', 'maintenance']
const SERVICE_MAP = new Map<string, string>(SYSTEM_SERVICES.map((s) => [s.id, s.label]))

export function canManageSystemAlerts(role?: string | null, isImpersonating = false): boolean {
  if (!role || isImpersonating) return false
  return role === 'super_admin'
}

export function formatServiceLabels(serviceIds: string[]): string[] {
  return (serviceIds || []).map((id) => SERVICE_MAP.get(id) || id)
}

export function validateSystemAlertInput(input: SystemAlertInput, now: Date = new Date()): { valid: boolean; error?: string } {
  const title = (input.title || '').trim()
  const message = (input.message || '').trim()

  if (!title || title.length < 3) {
    return { valid: false, error: 'Tytuł komunikatu musi mieć co najmniej 3 znaki.' }
  }
  if (title.length > 140) {
    return { valid: false, error: 'Tytuł komunikatu nie może przekraczać 140 znaków.' }
  }
  if (!message || message.length < 5) {
    return { valid: false, error: 'Treść komunikatu dla placówek jest wymagana (min. 5 znaków).' }
  }
  if (message.length > 500) {
    return { valid: false, error: 'Treść komunikatu nie może przekraczać 500 znaków.' }
  }
  if (!VALID_SEVERITIES.includes(input.severity)) {
    return { valid: false, error: 'Nieprawidłowy poziom ważności alertu.' }
  }
  if (!VALID_STATUSES.includes(input.status)) {
    return { valid: false, error: 'Nieprawidłowy status techniczny systemu.' }
  }
  if (!Array.isArray(input.affectedServices) || input.affectedServices.some((s) => !SERVICE_MAP.has(s))) {
    return { valid: false, error: 'Wybrano nieprawidłową usługę systemową.' }
  }
  if (input.expiresAt) {
    const expires = new Date(input.expiresAt).getTime()
    if (Number.isNaN(expires)) return { valid: false, error: 'Nieprawidłowy termin wygaśnięcia.' }
    if (expires <= now.getTime()) return { valid: false, error: 'Termin wygaśnięcia musi być w przyszłości.' }
  }

  const combinedLower = `${title} ${message}`.toLowerCase()
  for (const forbidden of FORBIDDEN_UI_TERMS) {
    const stem = forbidden.term.length > 4 ? forbidden.term.slice(0, -1).toLowerCase() : forbidden.term.toLowerCase()
    if (combinedLower.includes(stem)) {
      return {
        valid: false,
        error: `Komunikat zawiera niedozwolony termin kliniczny. Użyj zamiennika: ${forbidden.replacement}.`,
      }
    }
  }

  return { valid: true }
}

const SEVERITY_PRIORITY: Record<SystemAlertSeverity, number> = {
  error: 3,
  warning: 2,
  info: 1,
}

export type AlertLifecycle = 'active' | 'expired' | 'resolved'

export const ALERT_LIFECYCLE_LABELS: Record<AlertLifecycle, string> = {
  active: 'Aktywny',
  expired: 'Wygasł',
  resolved: 'Zakończony',
}

/** Stan alertu w danej chwili: zakończony ręcznie, po terminie albo aktywny. */
export function getAlertLifecycle(alert: SystemAlertRecord, now: Date = new Date()): AlertLifecycle {
  if (!alert.is_active) return 'resolved'
  if (alert.expires_at && new Date(alert.expires_at).getTime() <= now.getTime()) return 'expired'
  return 'active'
}

/** Wiersz do zapisu w system_alerts; expires_at tylko, gdy podano termin. */
export function buildSystemAlertInsert(input: SystemAlertInput, userId: string) {
  return {
    title: input.title.trim(),
    message: input.message.trim(),
    severity: input.severity,
    status: input.status,
    affected_services: input.affectedServices,
    is_active: true,
    created_by: userId,
    ...(input.expiresAt ? { expires_at: new Date(input.expiresAt).toISOString() } : {}),
  }
}

export function getActiveSystemBannerState(alerts: SystemAlertRecord[], now: Date = new Date()): ActiveSystemBannerState | null {
  const active = (alerts || []).filter((a) => getAlertLifecycle(a, now) === 'active')
  if (active.length === 0) return null

  const sorted = [...active].sort((a, b) => {
    const prioDiff = (SEVERITY_PRIORITY[b.severity] || 0) - (SEVERITY_PRIORITY[a.severity] || 0)
    if (prioDiff !== 0) return prioDiff
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const top = sorted[0]
  return {
    id: top.id,
    title: top.title,
    message: top.message,
    severity: top.severity,
    status: top.status,
    affectedServices: top.affected_services || [],
    serviceLabels: formatServiceLabels(top.affected_services || []),
    createdAt: top.created_at,
  }
}

export function buildSystemAlertAuditPayload(params: {
  action: 'SYSTEM_ALERT_PUBLISHED' | 'SYSTEM_ALERT_RESOLVED'
  alertId: string
  severity: SystemAlertSeverity
  status: SystemAlertStatus
  affectedServices: string[]
}) {
  return {
    alert_id: params.alertId,
    event: params.action,
    severity: params.severity,
    status: params.status,
    affected_services: params.affectedServices,
  }
}
