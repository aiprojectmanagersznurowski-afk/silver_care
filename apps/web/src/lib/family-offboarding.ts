import { formatPersonName } from './person-name'

export const OFFBOARDING_RETENTION_DAYS = 30

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

const MS_PER_DAY = 24 * 60 * 60 * 1000

function parseUtcDay(isoDate: string): Date {
  const day = isoDate.slice(0, 10)
  return new Date(`${day}T00:00:00Z`)
}

function formatUtcDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Wyznacza stan widoku portalu rodziny z uwzględnieniem 30-dniowego okna retencji
 * po zgonie lub wypisie podopiecznego (SC-FAM-07, FAM-RESIDENT-OFFBOARDING).
 */
export function evaluateFamilyOffboardingState(
  resident: {
    death_date?: string | null
    contract_end_date?: string | null
    archived_at?: string | null
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

  const todayUtc = parseUtcDay(now.toISOString())
  const endDate = resident.death_date ?? resident.contract_end_date ?? null

  if (!endDate) {
    return { mode: 'active' }
  }

  const endUtc = parseUtcDay(endDate)
  if (!resident.death_date && endUtc.getTime() > todayUtc.getTime()) {
    return { mode: 'active' }
  }

  const reason: 'deceased' | 'discharged' = resident.death_date ? 'deceased' : 'discharged'
  const expiryUtc = new Date(endUtc.getTime() + OFFBOARDING_RETENTION_DAYS * MS_PER_DAY)
  const diffDays = Math.round((expiryUtc.getTime() - todayUtc.getTime()) / MS_PER_DAY)

  if (diffDays <= 0) {
    return {
      mode: 'retention_expired',
      reason,
      endDate: endDate.slice(0, 10),
    }
  }

  return {
    mode: 'memorial_window',
    reason,
    endDate: endDate.slice(0, 10),
    expiryDate: formatUtcDay(expiryUtc),
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
 * Buduje pamiątkowe archiwum pobytu podopiecznego do pobrania przez bliskich (AC2).
 * Zachowuje granice MDR (wyłącznie metryki behawioralne i zatwierdzone raporty).
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
  const fullName = formatPersonName(params.resident.first_name, params.resident.last_name)
  const slug = slugifyAscii(`${params.resident.last_name}-${params.resident.first_name}`)
  const fileName = `archiwum-pamiatkowe-${slug || 'podopieczny'}.txt`
  const genDate = params.generatedAt ?? new Date().toISOString().slice(0, 10)
  const endDate = params.resident.death_date ?? params.resident.contract_end_date ?? '—'

  const headerLines = [
    '============================================================',
    'SILVER CARE — PAMIĄTKOWE ARCHIWUM POBYTU PODOPIECZNEGO',
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
