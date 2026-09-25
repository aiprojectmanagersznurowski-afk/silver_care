/**
 * Helpery dla rejestru audytowego (SEC-AUDIT-EXPORT-TIMEZONE, SEC-NO-PII-LOGS)
 */

export interface AuditLogEntry {
  id: string
  organization_id: string
  action: string
  performed_by: string | null
  created_at: string
  table_name?: string
  payload?: Record<string, unknown>
}

/**
 * Formatowanie znacznika czasu UTC do strefy czasowej i locale przeglądarki klienta
 */
export function formatAuditTimestamp(
  utcIsoString: string,
  timeZone?: string,
  locale = 'pl-PL'
): string {
  try {
    const date = new Date(utcIsoString)
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      ...(timeZone ? { timeZone } : {})
    }
    return new Intl.DateTimeFormat(locale, options).format(date)
  } catch {
    return utcIsoString
  }
}

/**
 * Filtrowanie logów po przedziale dat (start_date <= log.created_at <= end_date)
 */
export function filterAuditLogsByDate(
  logs: AuditLogEntry[],
  startDate?: string,
  endDate?: string
): AuditLogEntry[] {
  if (!startDate && !endDate) return logs

  const startMs = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : -Infinity
  const endMs = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity

  return logs.filter(log => {
    const logMs = new Date(log.created_at).getTime()
    return logMs >= startMs && logMs <= endMs
  })
}

/**
 * Sanityzacja payloadu pod kątem PII przed eksportem RODO
 */
export function sanitizeAuditPayload(payload?: Record<string, unknown>): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {}
  const sanitized: Record<string, unknown> = {}
  
  const forbiddenKeys = ['first_name', 'last_name', 'pesel_hash', 'name', 'email', 'password', 'phone']

  for (const [key, val] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase()
    if (forbiddenKeys.some(fk => lowerKey.includes(fk))) {
      continue
    }
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      sanitized[key] = sanitizeAuditPayload(val as Record<string, unknown>)
    } else {
      sanitized[key] = val
    }
  }

  return sanitized
}

/**
 * Generowanie pliku CSV z audytu zgodnego z RODO (brak PII, czytelny User ID)
 */
export function formatAuditToCsv(logs: AuditLogEntry[], timeZone?: string): string {
  const headers = ['Czas (Lokalny)', 'Czas (UTC)', 'Akcja', 'User ID (Aktor)', 'Szczegoly']
  
  const rows = logs.map(log => {
    const localTime = formatAuditTimestamp(log.created_at, timeZone)
    const utcTime = log.created_at
    const action = log.action
    const actor = log.performed_by || 'System'
    const safePayload = JSON.stringify(sanitizeAuditPayload(log.payload)).replace(/"/g, '""')

    return `"${localTime}","${utcTime}","${action}","${actor}","${safePayload}"`
  })

  return [headers.join(','), ...rows].join('\n')
}

/**
 * Generowanie JSON z audytu zgodnego z RODO
 */
export function formatAuditToJson(logs: AuditLogEntry[], timeZone?: string): string {
  const exportItems = logs.map(log => ({
    id: log.id,
    timestamp_local: formatAuditTimestamp(log.created_at, timeZone),
    timestamp_utc: log.created_at,
    action: log.action,
    performed_by: log.performed_by || 'System',
    payload: sanitizeAuditPayload(log.payload)
  }))

  return JSON.stringify(exportItems, null, 2)
}
