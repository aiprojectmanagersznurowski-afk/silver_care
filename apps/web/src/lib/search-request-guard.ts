/**
 * Strażnik żądań wyszukiwarki: ważne jest tylko ostatnio rozpoczęte żądanie.
 * Odpowiedź na starsze (lub unieważnione, np. po wyczyszczeniu pola) nie może nadpisać wyników.
 */
export function createRequestGuard() {
  let current = 0
  return {
    /** Rozpoczyna nowe żądanie i unieważnia wszystkie wcześniejsze. */
    next: () => ++current,
    /** Unieważnia żądania w toku bez rozpoczynania nowego. */
    invalidate: () => {
      current += 1
    },
    isCurrent: (id: number) => id === current,
  }
}
