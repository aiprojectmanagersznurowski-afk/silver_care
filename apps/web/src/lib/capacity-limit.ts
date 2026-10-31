import { CAPACITY_POLICY } from '@silvercare/contracts/src/generated/facility'

/**
 * Ocena limitu miejsc placówki (ADM-CAPACITY-LIMIT, SC-ADM-22).
 * Limit = łóżka = maks. liczba aktywnych podopiecznych. Punkty kontroli i to, co liczą,
 * pochodzą z CAPACITY_POLICY w kontrakcie — tu tylko arytmetyka i tekst.
 */
export type CapacityOperation = (typeof CAPACITY_POLICY.checkpoints)[number]['id']

export interface CapacityEvaluation {
  operation: CapacityOperation
  counts: 'beds' | 'residents'
  limit: number
  projected: number
  excess: number
  exceeds: boolean
}

export function evaluateCapacity(input: {
  operation: CapacityOperation
  residentLimit: number
  currentBeds: number
  currentResidents: number
  added: number
}): CapacityEvaluation {
  const checkpoint = CAPACITY_POLICY.checkpoints.find((c) => c.id === input.operation)
  if (!checkpoint) throw new Error(`Nieznany punkt kontroli limitu miejsc: ${input.operation}`)

  const counts = checkpoint.counts as CapacityEvaluation['counts']
  const current = counts === 'beds' ? input.currentBeds : input.currentResidents
  const projected = current + input.added
  const excess = Math.max(0, projected - input.residentLimit)

  return { operation: input.operation, counts, limit: input.residentLimit, projected, excess, exceeds: excess > 0 }
}

export interface ResidentPresenceFields {
  archived_at: string | null
  death_date: string | null
  contract_end_date: string | null
}

/** Kolumny potrzebne do ustalenia, czy podopieczny zajmuje miejsce — do .select() w zapytaniach. */
export const RESIDENT_PRESENCE_COLUMNS = 'archived_at, death_date, contract_end_date'

function warsawToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(now)
}

/**
 * Miejsce zajmuje wyłącznie podopieczny faktycznie przebywający w placówce (decyzja Michała 2026-10-29):
 * bez zarchiwizowanych, zmarłych i z umową zakończoną dziś lub wcześniej. Hospitalizacja dojdzie
 * ze statusem nieobecności (ADR-021, SC-ADM-21/AC4).
 */
export function isPresentResident(resident: ResidentPresenceFields, now: Date = new Date()): boolean {
  if (resident.archived_at || resident.death_date) return false
  if (resident.contract_end_date && resident.contract_end_date.slice(0, 10) <= warsawToday(now)) return false
  return true
}

export function countPresentResidents(residents: ResidentPresenceFields[], now: Date = new Date()): number {
  return residents.filter((r) => isPresentResident(r, now)).length
}

/** Wpis audytu przekroczenia — wyłącznie liczby i rodzaj operacji, bez danych osobowych. */
export function buildCapacityExceededAudit(evaluation: CapacityEvaluation) {
  return {
    action: CAPACITY_POLICY.onExceed.auditAction,
    payload: {
      operation: evaluation.operation,
      counts: evaluation.counts,
      resident_limit: evaluation.limit,
      projected_count: evaluation.projected,
      excess: evaluation.excess,
    },
  }
}

function bedsWord(n: number): string {
  const lastTwo = n % 100
  const last = n % 10
  if (n === 1) return 'łóżko'
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'łóżka'
  return 'łóżek'
}

function residentsWord(n: number): string {
  return n === 1 ? 'podopiecznego' : 'podopiecznych'
}

/** Komunikat ostrzeżenia przed zatwierdzeniem operacji ponad limit (SC-ADM-22/AC3). */
export function capacityWarningMessage(evaluation: CapacityEvaluation): string {
  const noun = evaluation.counts === 'beds' ? bedsWord(evaluation.projected) : residentsWord(evaluation.projected)
  return `Placówka będzie miała ${evaluation.projected} ${noun} przy limicie miejsc ${evaluation.limit} (o ${evaluation.excess} więcej).`
}
