import { SHIFT_POLICY } from '@silvercare/contracts/src/generated/facility'

/**
 * Definicje zmian placówki (NUR-SHIFT-CONFIG, SC-NUR-12/AC1): walidacja formularza, opis godzin i liczba zmian.
 * Granice liczby zmian pochodzą z SHIFT_POLICY w kontrakcie; strefa zawsze Europe/Warsaw.
 */
export interface ShiftDefinitionInput {
  name: string
  startTime: string
  endTime: string
}

export interface ValidShiftDefinition {
  code: string
  name: string
  startTime: string
  endTime: string
}

export type ShiftDefinitionValidation =
  | { valid: true; data: ValidShiftDefinition }
  | { valid: false; error: string }

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const NAME_MAX = 40

/** Kod zmiany z nazwy: wielkie litery, bez polskich znaków i znaków specjalnych, myślniki zamiast spacji. */
function toCode(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
}

export function validateShiftDefinitionInput(input: ShiftDefinitionInput): ShiftDefinitionValidation {
  const name = (input.name ?? '').trim()
  if (!name) return { valid: false, error: 'Podaj nazwę zmiany.' }
  if (name.length > NAME_MAX) return { valid: false, error: `Nazwa zmiany ma najwyżej ${NAME_MAX} znaków.` }
  if (!TIME_RE.test(input.startTime ?? '') || !TIME_RE.test(input.endTime ?? '')) {
    return { valid: false, error: 'Godziny zmiany podaj w formacie GG:MM, np. 07:00.' }
  }
  if (input.startTime === input.endTime) {
    return { valid: false, error: 'Początek i koniec zmiany muszą się różnić.' }
  }
  const code = toCode(name)
  if (!code) return { valid: false, error: 'Nazwa zmiany musi zawierać litery lub cyfry.' }
  return { valid: true, data: { code, name, startTime: input.startTime, endTime: input.endTime } }
}

/** Zmiana, której koniec nie jest później niż początek, przechodzi przez północ (jak kolumna crosses_midnight). */
export function crossesMidnight(startTime: string, endTime: string): boolean {
  return endTime <= startTime
}

export function formatShiftRange(startTime: string, endTime: string): string {
  const range = `${startTime}–${endTime}`
  return crossesMidnight(startTime, endTime) ? `${range} (przez północ)` : range
}

/** Baza zwraca czas jako GG:MM:SS — ekran pokazuje GG:MM. */
export function trimSeconds(time: string): string {
  return time.slice(0, 5)
}

export type ShiftCountStatus = 'too_few' | 'ok' | 'too_many'

export function shiftCountStatus(activeCount: number): ShiftCountStatus {
  if (activeCount < SHIFT_POLICY.shiftsPerDay.min) return 'too_few'
  if (activeCount > SHIFT_POLICY.shiftsPerDay.max) return 'too_many'
  return 'ok'
}

export function shiftCountMessage(activeCount: number): string {
  const { min, max } = SHIFT_POLICY.shiftsPerDay
  const status = shiftCountStatus(activeCount)
  if (status === 'too_few') return `Aktywne zmiany: ${activeCount}. Placówka powinna mieć ${min} albo ${max} zmiany na dobę.`
  if (status === 'too_many') return `Aktywne zmiany: ${activeCount}. Najwyżej ${max} zmiany na dobę.`
  return `Aktywne zmiany: ${activeCount} (dozwolone ${min}–${max}).`
}
