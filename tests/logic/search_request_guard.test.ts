import { describe, it, expect } from 'vitest'
import { createRequestGuard } from '../../apps/web/src/lib/search-request-guard'

/**
 * @REQ: UI-FOUR-STATES
 * @REQ: UI-ACCESSIBILITY
 *
 * Wyszukiwarka wysyła zapytania podczas pisania. Odpowiedź na starsze zapytanie nie może nadpisać
 * wyników nowszego, a zapytanie w toku musi tracić ważność, gdy pole zostaje wyczyszczone.
 */
describe('createRequestGuard (@REQ: UI-FOUR-STATES)', () => {
  it('@REQ: UI-FOUR-STATES - ważne jest tylko ostatnio rozpoczęte żądanie', () => {
    const guard = createRequestGuard()
    const first = guard.next()
    const second = guard.next()
    expect(guard.isCurrent(first)).toBe(false)
    expect(guard.isCurrent(second)).toBe(true)
  })

  it('@REQ: UI-FOUR-STATES - odpowiedzi w odwrotnej kolejności: starsza nie nadpisuje nowszej', () => {
    const guard = createRequestGuard()
    const applied: string[] = []
    const send = (label: string) => {
      const id = guard.next()
      return (): void => {
        if (guard.isCurrent(id)) applied.push(label)
      }
    }
    const kow = send('Kow')
    const kowalski = send('Kowalski')
    kowalski() // nowsze wraca pierwsze
    kow() // starsze wraca później i ma zostać odrzucone
    expect(applied).toEqual(['Kowalski'])
  })

  it('@REQ: UI-FOUR-STATES - invalidate unieważnia żądanie w toku (np. po wyczyszczeniu pola)', () => {
    const guard = createRequestGuard()
    const inFlight = guard.next()
    guard.invalidate()
    expect(guard.isCurrent(inFlight)).toBe(false)
  })

  it('@REQ: UI-FOUR-STATES - każdy strażnik liczy niezależnie', () => {
    const a = createRequestGuard()
    const b = createRequestGuard()
    const idA = a.next()
    b.next()
    b.next()
    expect(a.isCurrent(idA)).toBe(true)
  })
})
