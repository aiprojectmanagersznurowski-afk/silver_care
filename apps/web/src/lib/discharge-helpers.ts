import {
  CONTRACT_END_REASONS,
  CONTRACT_END_REASON_LABELS,
  ContractEndReason,
} from './reporting-constants'

export interface DischargePayloadInput {
  residentId: string
  contractEndDate: string
  contractEndReason: string
  deathDate?: string | null
  notes?: string | null
}

export interface ValidDischargePayload {
  residentId: string
  contractEndDate: string
  contractEndReason: ContractEndReason
  deathDate: string | null
  notes: string | null
}

export type DischargeValidationResult =
  | { isValid: true; data: ValidDischargePayload }
  | { isValid: false; errors: string[] }

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidIsoDate(str: string): boolean {
  if (!ISO_DATE_REGEX.test(str)) return false
  const d = new Date(str)
  return !isNaN(d.getTime()) && str === d.toISOString().slice(0, 10)
}

/**
 * Waliduje dane wejściowe operacji zakończenia pobytu / wypisu podopiecznego
 * Zgodnie z @REQ: ADM-BED-ASSIGNMENT i @REQ: ADM-ARCHIVE
 */
export function validateDischargePayload(input: unknown): DischargeValidationResult {
  const errors: string[] = []

  if (!input || typeof input !== 'object') {
    return { isValid: false, errors: ['Brak poprawnych danych wejściowych.'] }
  }

  const raw = input as Partial<DischargePayloadInput>

  // 1. Walidacja residentId
  if (!raw.residentId || typeof raw.residentId !== 'string' || !UUID_REGEX.test(raw.residentId)) {
    errors.push('Niepoprawny identyfikator podopiecznego (wymagany UUID).')
  }

  // 2. Walidacja daty zakończenia umowy (contractEndDate)
  if (!raw.contractEndDate || typeof raw.contractEndDate !== 'string' || !isValidIsoDate(raw.contractEndDate)) {
    errors.push('Data zakończenia pobytu musi być poprawną datą (wymagany format RRRR-MM-DD).')
  }

  // 3. Walidacja powodu zakończenia (contractEndReason)
  const isReasonValid =
    typeof raw.contractEndReason === 'string' &&
    CONTRACT_END_REASONS.includes(raw.contractEndReason as ContractEndReason)

  if (!isReasonValid) {
    errors.push(
      `Nieznany powód zakończenia pobytu. Dopuszczalne: ${CONTRACT_END_REASONS.join(', ')}`
    )
  }

  // 4. Walidacja zgonu (deathDate)
  let cleanDeathDate: string | null = null
  if (raw.contractEndReason === 'death') {
    if (!raw.deathDate || typeof raw.deathDate !== 'string' || !isValidIsoDate(raw.deathDate)) {
      errors.push('W przypadku zgonu data zgonu jest wymagana.')
    } else {
      cleanDeathDate = raw.deathDate
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  const cleanNotes =
    raw.notes && typeof raw.notes === 'string' && raw.notes.trim().length > 0
      ? raw.notes.trim()
      : null

  return {
    isValid: true,
    data: {
      residentId: raw.residentId!,
      contractEndDate: raw.contractEndDate!,
      contractEndReason: raw.contractEndReason as ContractEndReason,
      deathDate: cleanDeathDate,
      notes: cleanNotes,
    },
  }
}

export type ResidentStatusKey = 'active' | 'discharged' | 'deceased' | 'archived'

/**
 * Wyznacza status podopiecznego z uwzględnieniem Wariantu B
 * (wypisanie lub zgon nie ustawia natychmiast archived_at, rodzina ma wgląd read-only)
 */
export function determineResidentStatus(resident: {
  archived_at?: string | null
  death_date?: string | null
  contract_end_date?: string | null
}): ResidentStatusKey {
  if (resident.archived_at) {
    return 'archived'
  }
  if (resident.death_date) {
    return 'deceased'
  }
  if (resident.contract_end_date) {
    const end = new Date(resident.contract_end_date)
    const now = new Date()
    // Porównanie z dzisiejszą datą
    if (end <= now) {
      return 'discharged'
    }
  }
  return 'active'
}

export const RESIDENT_STATUS_LABELS: Record<ResidentStatusKey, string> = {
  active: 'Aktywny',
  discharged: 'Wypisany',
  deceased: 'Zgon',
  archived: 'Zarchiwizowany',
}

export interface DeathInitiationPayloadInput {
  residentId: string
  deathDate: string
  notes?: string | null
}

export interface ValidDeathInitiationPayload {
  residentId: string
  deathDate: string
  notes: string | null
}

export type DeathInitiationValidationResult =
  | { isValid: true; data: ValidDeathInitiationPayload }
  | { isValid: false; errors: string[] }

export const DEATH_INITIATION_MARKER = '[Zgłoszenie zgonu — oczekuje na zatwierdzenie umowy]'

export function canInitiateDeathProcedure(
  role: string | undefined,
  isImpersonating: boolean
): boolean {
  if (isImpersonating) return false
  return role === 'nurse' || role === 'org_admin'
}

export function validateDeathInitiationPayload(
  input: unknown
): DeathInitiationValidationResult {
  const res = validateDischargePayload({
    ...(input && typeof input === 'object' ? input : {}),
    contractEndDate: (input as Partial<DeathInitiationPayloadInput>)?.deathDate,
    contractEndReason: 'death',
  })

  if (!res.isValid) {
    return { isValid: false, errors: res.errors }
  }

  return {
    isValid: true,
    data: {
      residentId: res.data.residentId,
      deathDate: res.data.deathDate!,
      notes: res.data.notes,
    },
  }
}

export function buildPostMortemSanitizationTasks(params: {
  residentId: string
  targetDate: string
  bedLabel?: string | null
}) {
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
      title: `Sanityzacja i dezynfekcja zwolnionego miejsca${bedInfo}`,
      family_visible: false,
    },
  ]
}

export function formatDeathInitiationNote(params: {
  existingNotes?: string | null
  deathDate: string
  unassignedBedLabel?: string | null
  notes?: string | null
}): string {
  const bedPart = params.unassignedBedLabel
    ? ` | Zwolniono do dezynfekcji: ${params.unassignedBedLabel}`
    : ''
  const customPart = params.notes ? ` — ${params.notes.trim()}` : ''
  const line = `${DEATH_INITIATION_MARKER} (data zgonu: ${params.deathDate}${bedPart})${customPart}`
  const base = params.existingNotes?.trim()
  return base ? `${base}\n${line}` : line
}

export function hasPendingDeathInitiation(resident: {
  notes?: string | null
  death_date?: string | null
  death_reported_at?: string | null
}): boolean {
  if (resident.death_date) return false
  if (resident.death_reported_at) return true
  return Boolean(resident.notes && resident.notes.includes(DEATH_INITIATION_MARKER))
}
