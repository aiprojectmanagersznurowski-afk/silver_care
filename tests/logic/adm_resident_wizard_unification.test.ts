import { describe, it, expect } from 'vitest'
import { parseNationalId, suggestBeds, type BedCandidate } from '../../apps/web/src/lib/admission-helpers'

/**
 * @REQ: ADM-RESIDENT-ADD
 * ADM-RESIDENT-WIZARD-UNIFICATION: Unifikacja procesu przyjęcia podopiecznego
 */
describe('ADM-RESIDENT-WIZARD-UNIFICATION: Unifikacja procesu przyjęcia podopiecznego', () => {
  it('waliduje format identyfikatora i wyznacza datę urodzenia podopiecznego @REQ: ADM-RESIDENT-ADD', () => {
    // Pesel urodzony w latach 1900-1999
    const res1900 = parseNationalId('48030501230')
    expect(res1900.valid).toBe(true)
    expect(res1900.birthDate).toBe('1948-03-05')
    expect(res1900.gender).toBe('M')
    expect(res1900.genderLabel).toBe('Mężczyzna')

    // Pesel urodzony w latach 2000-2099
    const res2000 = parseNationalId('05211504567')
    expect(res2000.valid).toBe(true)
    expect(res2000.birthDate).toBe('2005-01-15')
    expect(res2000.gender).toBe('F')
    expect(res2000.genderLabel).toBe('Kobieta')
  })

  it('odrzuca nieprawidłowe lub niekompletne identyfikatory z czytelnym komunikatem @REQ: ADM-RESIDENT-ADD', () => {
    const emptyRes = parseNationalId('')
    expect(emptyRes.valid).toBe(false)
    expect(emptyRes.error).toContain('11 cyfr')

    const shortRes = parseNationalId('990101')
    expect(shortRes.valid).toBe(false)
    expect(shortRes.error).toContain('11 cyfr')

    const lettersRes = parseNationalId('9901011234a')
    expect(lettersRes.valid).toBe(false)
    expect(lettersRes.error).toContain('11 cyfr')
  })

  it('unifikacja doboru łóżka: preferuje parter dla podopiecznych leżących i hospicyjnych @REQ: ADM-RESIDENT-ADD', () => {
    const candidates: BedCandidate[] = [
      {
        bedId: 'bed-ground',
        bedNumber: '1',
        roomId: 'room-01',
        roomNumber: '01',
        floorNumber: 0,
        capacity: 2,
        currentOccupants: [],
      },
      {
        bedId: 'bed-floor-2',
        bedNumber: '1',
        roomId: 'room-201',
        roomNumber: '201',
        floorNumber: 2,
        capacity: 2,
        currentOccupants: [],
      },
    ]

    const suggestions = suggestBeds(candidates, { gender: 'M', careLevel: 'bedridden' })
    expect(suggestions).toHaveLength(2)
    expect(suggestions[0].bedId).toBe('bed-ground')
    expect(suggestions[0].score).toBeGreaterThan(suggestions[1].score)
    expect(suggestions[0].reason).toContain('Parter')
  })

  it('unifikacja doboru łóżka: wymusza zgodność płci w pokojach wieloosobowych @REQ: ADM-RESIDENT-ADD', () => {
    const candidates: BedCandidate[] = [
      {
        bedId: 'bed-f-room',
        bedNumber: '2',
        roomId: 'room-101',
        roomNumber: '101',
        floorNumber: 1,
        capacity: 2,
        currentOccupants: [{ gender: 'F' }],
      },
      {
        bedId: 'bed-m-room',
        bedNumber: '2',
        roomId: 'room-102',
        roomNumber: '102',
        floorNumber: 1,
        capacity: 2,
        currentOccupants: [{ gender: 'M' }],
      },
    ]

    // Szukamy miejsca dla kobiety
    const suggestions = suggestBeds(candidates, { gender: 'F', careLevel: 'walking' })
    const topMatch = suggestions[0]
    const penalizedMatch = suggestions[1]

    expect(topMatch.bedId).toBe('bed-f-room')
    expect(topMatch.score).toBeGreaterThan(penalizedMatch.score)
    expect(penalizedMatch.reason).toContain('odmiennej płci')
  })
})
