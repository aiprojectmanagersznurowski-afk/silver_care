import { CONTRACT_END_REASONS, type ContractEndReason } from './reporting-constants'

export interface DischargePayloadInput {
  residentId: string
  contractEndDate: string
  contractEndReason: string
  deathDate?: string | null
  notes?: string | null
}

export interface ValidatedDischargeData {
  residentId: string
  contractEndDate: string
  contractEndReason: ContractEndReason
  deathDate: string | null
  notes: string | null
}

export type ValidationResult =
  | { isValid: true; data: ValidatedDischargeData }
  | { isValid: false; errors: string[] }

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidIsoDate(str: string): boolean {
  if (!ISO_DATE_REGEX.test(str)) return false
  const d = new Date(str)
  return !isNaN(d.getTime()) && str === d.toISOString().slice(0, 10)
}

export function validateDischargePayload(input: unknown): ValidationResult {
  const errors: string[] = []

  if (!input || typeof input !== 'object') {
    return { isValid: false, errors: ['Nieprawidłowy format danych wejściowych.'] }
  }

  const payload = input as Record<string, unknown>

  if (!payload.residentId || typeof payload.residentId !== 'string' || !UUID_REGEX.test(payload.residentId)) {
    errors.push('Identyfikator podopiecznego jest nieprawidłowy.')
  }

  if (!payload.contractEndDate || typeof payload.contractEndDate !== 'string' || !isValidIsoDate(payload.contractEndDate)) {
    errors.push('Data zakończenia pobytu/umowy musi mieć format YYYY-MM-DD.')
  }

  const isKnownReason =
    typeof payload.contractEndReason === 'string' &&
    CONTRACT_END_REASONS.includes(payload.contractEndReason as ContractEndReason)

  if (!isKnownReason) {
    errors.push(`Powód zakończenia pobytu jest nieprawidłowy. Dopuszczalne: ${CONTRACT_END_REASONS.join(', ')}.`)
  }

  let finalDeathDate: string | null = null
  if (payload.contractEndReason === 'death') {
    if (!payload.deathDate || typeof payload.deathDate !== 'string' || !isValidIsoDate(payload.deathDate)) {
      errors.push('W przypadku zgonu data zgonu jest wymagana.')
    } else {
      finalDeathDate = payload.deathDate
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  const trimmedNotes =
    payload.notes && typeof payload.notes === 'string' && payload.notes.trim().length > 0
      ? payload.notes.trim()
      : null

  return {
    isValid: true,
    data: {
      residentId: payload.residentId as string,
      contractEndDate: payload.contractEndDate as string,
      contractEndReason: payload.contractEndReason as ContractEndReason,
      deathDate: finalDeathDate,
      notes: trimmedNotes,
    },
  }
}

export function determineResidentStatus(resident: {
  archived_at?: string | null
  death_date?: string | null
  contract_end_date?: string | null
}): 'active' | 'discharged' | 'deceased' | 'archived' {
  if (resident.archived_at) return 'archived'
  if (resident.death_date) return 'deceased'
  if (resident.contract_end_date) {
    const end = new Date(resident.contract_end_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (end <= today) return 'discharged'
  }
  return 'active'
}

export const DISCHARGE_STATUS_LABELS: Record<string, string> = {
  active: 'Aktywny',
  discharged: 'Wypisany',
  deceased: 'Zgon',
  archived: 'Zarchiwizowany',
}

export function canInitiateDeathProcedure(
  role: string | undefined,
  isImpersonating: boolean
): boolean {
  if (isImpersonating) return false
  return role === 'nurse' || role === 'org_admin'
}

export interface DeathInitiationPayloadInput {
  residentId: string
  deathDate: string
  notes?: string | null
}

export interface ValidatedDeathInitiationData {
  residentId: string
  deathDate: string
  notes: string | null
}

export type DeathInitiationValidationResult =
  | { isValid: true; data: ValidatedDeathInitiationData }
  | { isValid: false; errors: string[] }

export function validateDeathInitiationPayload(input: unknown): DeathInitiationValidationResult {
  const errors: string[] = []
  if (!input || typeof input !== 'object') {
    return { isValid: false, errors: ['Nieprawidłowy format danych wejściowych.'] }
  }
  const payload = input as Record<string, unknown>

  if (!payload.residentId || typeof payload.residentId !== 'string' || !UUID_REGEX.test(payload.residentId)) {
    errors.push('Identyfikator podopiecznego jest nieprawidłowy.')
  }

  if (!payload.deathDate || typeof payload.deathDate !== 'string' || !isValidIsoDate(payload.deathDate)) {
    errors.push('Data zgonu jest wymagana i musi mieć format YYYY-MM-DD.')
  }

  if (errors.length > 0) return { isValid: false, errors }

  const trimmedNotes =
    payload.notes && typeof payload.notes === 'string' && payload.notes.trim().length > 0
      ? payload.notes.trim()
      : null

  return {
    isValid: true,
    data: {
      residentId: payload.residentId as string,
      deathDate: payload.deathDate as string,
      notes: trimmedNotes,
    },
  }
}

export function buildPostMortemSanitizationTasks(params: {
  residentId: string
  targetDate: string
  bedLabel?: string | null
}): Array<{
  resident_id: string
  target_date: string
  time: string
  type: string
  title: string
  family_visible: boolean
}> {
  const bedInfo = params.bedLabel ? ` (${params.bedLabel})` : ''
  return [
    {
      resident_id: params.residentId,
      target_date: params.targetDate,
      time: '08:00',
      type: 'staff_only',
      title: 'Procedura po zgonie: wezwanie lekarza do stwierdzenia zgonu i karty zgonu',
      family_visible: false,
    },
    {
      resident_id: params.residentId,
      target_date: params.targetDate,
      time: '09:00',
      type: 'staff_only',
      title: 'Procedura po zgonie: zabezpieczenie i spis depozytu rzeczy osobistych',
      family_visible: false,
    },
    {
      resident_id: params.residentId,
      target_date: params.targetDate,
      time: '10:00',
      type: 'staff_only',
      title: `Sanityzacja i dezynfekcja miejsca${bedInfo}`,
      family_visible: false,
    },
  ]
}

export interface PendingDeathReportInfo {
  reported_death_date: string
  reported_at: string
  notes?: string | null
}

export function extractPendingDeathReport(resident: {
  death_date?: string | null
  death_reported_at?: string | null
  reported_death_date?: string | null
  resident_death_reports?: PendingDeathReportInfo | PendingDeathReportInfo[] | null
}): PendingDeathReportInfo | null {
  if (resident.death_date) return null
  const rel = resident.resident_death_reports
  const row = Array.isArray(rel) ? rel[0] : rel
  if (row?.reported_at || row?.reported_death_date) {
    return {
      reported_death_date: row.reported_death_date,
      reported_at: row.reported_at,
      notes: row.notes ?? null,
    }
  }
  if (resident.death_reported_at || resident.reported_death_date) {
    return {
      reported_death_date: resident.reported_death_date || (resident.death_reported_at ? resident.death_reported_at.slice(0, 10) : ''),
      reported_at: resident.death_reported_at || resident.reported_death_date || '',
    }
  }
  return null
}

export function hasPendingDeathInitiation(resident: {
  death_date?: string | null
  death_reported_at?: string | null
  reported_death_date?: string | null
  resident_death_reports?: PendingDeathReportInfo | PendingDeathReportInfo[] | null
}): boolean {
  return extractPendingDeathReport(resident) !== null
}
