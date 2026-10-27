/**
 * @REQ: NUR-BOARD
 *
 * Logika wyznaczania bieżącej zmiany personelu i formatowania wskaźnika notatek (SC-NUR-06 / NUR-BOARD).
 * Dwie 12-godzinne zmiany w cyklu dobowym:
 * - Dzienna: 07:00 – 19:00
 * - Nocna: 19:00 – 07:00 (przechodzi przez północ)
 */

export function getCurrentShiftStart(now: Date = new Date()): Date {
  const current = new Date(now)
  const hours = current.getHours()
  const start = new Date(current)
  start.setMinutes(0, 0, 0)
  start.setSeconds(0, 0)

  if (hours >= 7 && hours < 19) {
    // Zmiana dzienna: dzisiaj od 07:00
    start.setHours(7)
  } else if (hours >= 19) {
    // Zmiana nocna przed północą: dzisiaj od 19:00
    start.setHours(19)
  } else {
    // Zmiana nocna po północy: wczoraj od 19:00
    start.setDate(start.getDate() - 1)
    start.setHours(19)
  }

  return start
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
