/**
 * @REQ: NUR-BOARD
 *
 * Logika wyznaczania bieżącej zmiany personelu i formatowania wskaźnika notatek (SC-NUR-06 / NUR-BOARD).
 * Dwie 12-godzinne zmiany w cyklu dobowym:
 * - Dzienna: 07:00 – 19:00
 * - Nocna: 19:00 – 07:00 (przechodzi przez północ)
 */

export function getCurrentShiftStart(now: Date = new Date()): Date {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  const formatted = dtf.format(now)
  const [datePart, timePart] = formatted.split(', ')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour] = timePart.split(':').map(Number)

  let shiftYear = year
  let shiftMonth = month
  let shiftDay = day
  let shiftHour = 7

  if (hour >= 7 && hour < 19) {
    shiftHour = 7
  } else if (hour >= 19) {
    shiftHour = 19
  } else {
    // Zmiana nocna po północy (przed 07:00): zmiana rozpoczęła się wczoraj o 19:00
    const prev = new Date(Date.UTC(year, month - 1, day - 1))
    shiftYear = prev.getUTCFullYear()
    shiftMonth = prev.getUTCMonth() + 1
    shiftDay = prev.getUTCDate()
    shiftHour = 19
  }

  const guess = new Date(Date.UTC(shiftYear, shiftMonth - 1, shiftDay, shiftHour, 0, 0))
  const getWarsawInstant = (d: Date) => {
    const parts = dtf.formatToParts(d)
    const m = Object.fromEntries(parts.map((p) => [p.type, p.value]))
    return new Date(Date.UTC(Number(m.year), Number(m.month) - 1, Number(m.day), Number(m.hour), Number(m.minute), Number(m.second)))
  }
  const diffMs = getWarsawInstant(guess).getTime() - guess.getTime()
  return new Date(guess.getTime() - diffMs)
}

export function filterCurrentShiftNotes<T extends { created_at?: string | null }>(
  notes: T[],
  shiftStart: Date = getCurrentShiftStart()
): T[] {
  const threshold = shiftStart.getTime()
  return notes.filter((n) => {
    if (!n.created_at) return true
    return new Date(n.created_at).getTime() >= threshold
  })
}

/**
 * Odmiana gramatyczna liczby notatek w języku polskim:
 * 0: Brak notatek
 * 1: 1 notatka
 * 2-4, 22-24, ...: X notatki
 * 5-21, 25-31, ...: X notatek
 */
export function formatNotesCount(count: number): string {
  if (count <= 0) return 'Brak notatek'
  if (count === 1) return '1 notatka'
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} notatki`
  }
  return `${count} notatek`
}
