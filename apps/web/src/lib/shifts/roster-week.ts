/**
 * Tydzień grafiku (NUR-SHIFT-CONFIG, SC-NUR-12/AC1a): poniedziałek–niedziela w strefie Europe/Warsaw.
 * Daty to teksty RRRR-MM-DD liczone arytmetyką UTC na dniach — zmiana czasu (koniec lata, początek lata)
 * nie dubluje ani nie gubi dnia.
 */
const DAY_MS = 24 * 60 * 60 * 1000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const WEEKDAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota']

function parse(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  return format(parse(value)) === value
}

/** Dzisiejsza data w Europe/Warsaw (nie w UTC). */
export function todayWarsaw(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(now)
}

/** Poniedziałek tygodnia, do którego należy data. */
export function weekStartOf(date: string): string {
  const d = parse(date)
  const offset = (d.getUTCDay() + 6) % 7
  return format(new Date(d.getTime() - offset * DAY_MS))
}

export function weekDays(weekStart: string): string[] {
  const start = parse(weekStart).getTime()
  return Array.from({ length: 7 }, (_, i) => format(new Date(start + i * DAY_MS)))
}

export function shiftWeek(weekStart: string, delta: number): string {
  return format(new Date(parse(weekStart).getTime() + delta * 7 * DAY_MS))
}

/** Parametr ?week= z adresu: poprawna data daje jej tydzień, w innym razie tydzień bieżący. */
export function normalizeWeekParam(value: string | undefined, now: Date = new Date()): string {
  return weekStartOf(value && isValidDate(value) ? value : todayWarsaw(now))
}

export function formatDayLabel(date: string): string {
  const d = parse(date)
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}`
}

export function formatWeekLabel(weekStart: string): string {
  const first = parse(weekStart)
  const last = parse(weekDays(weekStart)[6])
  const short = (d: Date) => `${d.getUTCDate()}.${d.getUTCMonth() + 1}`
  const sameYear = first.getUTCFullYear() === last.getUTCFullYear()
  return sameYear
    ? `${short(first)}–${short(last)}.${last.getUTCFullYear()}`
    : `${short(first)}.${first.getUTCFullYear()}–${short(last)}.${last.getUTCFullYear()}`
}
