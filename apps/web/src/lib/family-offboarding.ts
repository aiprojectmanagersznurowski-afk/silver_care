import { OFFBOARDING_RETENTION_DAYS } from '@silvercare/contracts/src/generated/roles'
import { formatPersonName } from './person-name'

export { OFFBOARDING_RETENTION_DAYS }

export type FamilyOffboardingState =
  | { mode: 'active' }
  | {
      mode: 'memorial_window'
      reason: 'deceased' | 'discharged'
      endDate: string
      expiryDate: string
      daysRemaining: number
    }
  | {
      mode: 'retention_expired'
      reason: 'deceased' | 'discharged' | 'archived'
      endDate: string | null
    }

function getWarsawDateString(date: Date): string {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return dtf.format(date)
}

function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

function diffCalendarDays(dateStrA: string, dateStrB: string): number {
  const [yA, mA, dA] = dateStrA.slice(0, 10).split('-').map(Number)
  const [yB, mB, dB] = dateStrB.slice(0, 10).split('-').map(Number)
  const utcA = Date.UTC(yA, mA - 1, dA)
  const utcB = Date.UTC(yB, mB - 1, dB)
  return Math.round((utcA - utcB) / (24 * 60 * 60 * 1000))
}

/**
 * Wyznacza stan widoku portalu rodziny z uwzględnieniem 30-dniowego okna retencji
 * po zgonie lub wypisie podopiecznego (SC-FAM-07, FAM-RESIDENT-OFFBOARDING).
 * Obliczenia kalendarzowe wykonywane w strefie Europe/Warsaw.
 */
export function evaluateFamilyOffboardingState(
  resident: {
    death_date?: string | null
    contract_end_date?: string | null
    archived_at?: string | null
    death_reported_at?: string | null
  },
  now: Date = new Date()
): FamilyOffboardingState {
  if (resident.archived_at) {
    return {
      mode: 'retention_expired',
      reason: 'archived',
      endDate: resident.death_date ?? resident.contract_end_date ?? resident.archived_at.slice(0, 10),
    }
  }

  const todayStr = getWarsawDateString(now)
  const endDate = resident.death_date ?? resident.contract_end_date ?? null

  if (!endDate) {
    return { mode: 'active' }
  }

  const endDateStr = endDate.slice(0, 10)
  if (!resident.death_date && diffCalendarDays(endDateStr, todayStr) > 0) {
    return { mode: 'active' }
  }

  const reason: 'deceased' | 'discharged' = resident.death_date ? 'deceased' : 'discharged'
  const expiryDate = addDaysToDateString(endDateStr, OFFBOARDING_RETENTION_DAYS)
  const diffDays = diffCalendarDays(expiryDate, todayStr)

  if (diffDays <= 0) {
    return {
      mode: 'retention_expired',
      reason,
      endDate: endDateStr,
    }
  }

  return {
    mode: 'memorial_window',
    reason,
    endDate: endDateStr,
    expiryDate,
    daysRemaining: diffDays,
  }
}

function slugifyAscii(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'l')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface MemorialReportEntry {
  id: string
  created_at: string
  content?: {
    text?: string
    metrics?: {
      steps?: number
      sleep_hours?: number
    }
  }
}

/**
 * Buduje archiwum pobytu podopiecznego do pobrania przez bliskich (AC2).
 * Dzieli nazewnictwo: pamiątkowe (po zgonie) vs raporty z pobytu (po wypisie).
 * Zachowuje granice MDR (wyłącznie metryki behawioralne i opublikowane raporty).
 */
export function buildMemorialArchiveDocument(params: {
  resident: {
    first_name: string
    last_name: string
    death_date?: string | null
    contract_end_date?: string | null
  }
  reports: MemorialReportEntry[]
  generatedAt?: string
}): { fileName: string; content: string } {
  const isDeceased = Boolean(params.resident.death_date)
  const fullName = formatPersonName(params.resident.first_name, params.resident.last_name)
  const slug = slugifyAscii(`${params.resident.last_name}-${params.resident.first_name}`)
  const fileName = isDeceased
    ? `archiwum-pamiatkowe-${slug || 'podopieczny'}.txt`
    : `archiwum-pobytu-${slug || 'podopieczny'}.txt`
  const genDate = params.generatedAt ?? new Date().toISOString().slice(0, 10)
  const endDate = params.resident.death_date ?? params.resident.contract_end_date ?? '—'
  const title = isDeceased
    ? 'SILVER CARE — PAMIĄTKOWE ARCHIWUM POBYTU PODOPIECZNEGO'
    : 'SILVER CARE — ARCHIWUM RAPORTÓW Z POBYTU PODOPIECZNEGO'

  const headerLines = [
    '============================================================',
    title,
    '============================================================',
    `Podopieczny: ${fullName}`,
    `Data zakończenia pobytu: ${endDate}`,
    `Data wygenerowania archiwum: ${genDate}`,
    `Liczba opublikowanych raportów dziennych: ${params.reports.length}`,
    '------------------------------------------------------------',
    '',
  ]

  const reportBlocks =
    params.reports.length === 0
      ? ['Brak opublikowanych raportów dziennych w historii pobytu.']
      : params.reports.map((r) => {
          const dateStr = r.created_at.slice(0, 10)
          const text = r.content?.text?.trim() || 'Brak treści podsumowania z tego dnia.'
          const stepsVal = r.content?.metrics?.steps
          const sleepVal = r.content?.metrics?.sleep_hours
          const metricsSummary = [
            typeof stepsVal === 'number' ? `Kroki: ${stepsVal}` : null,
            typeof sleepVal === 'number' ? `Czas snu: ${sleepVal} godz.` : null,
          ]
            .filter(Boolean)
            .join(' | ')

          return [
            `[${dateStr}] Raport dzienny`,
            text,
            ...(metricsSummary ? [`Aktywność i odpoczynek: ${metricsSummary}`] : []),
            '------------------------------------------------------------',
          ].join('\n')
        })

  return {
    fileName,
    content: [...headerLines, ...reportBlocks].join('\n'),
  }
}
