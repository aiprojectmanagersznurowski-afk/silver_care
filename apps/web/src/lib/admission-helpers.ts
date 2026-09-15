export interface ParsedIdentity {
  valid: boolean
  error?: string
  birthDate?: string // YYYY-MM-DD
  gender?: 'M' | 'F'
  genderLabel?: string // Mężczyzna | Kobieta
}

export function parseNationalId(idNumber: string): ParsedIdentity {
  const cleaned = (idNumber || '').trim()
  if (cleaned.length !== 11 || !/^\d{11}$/.test(cleaned)) {
    return { valid: false, error: 'Numer identyfikacyjny musi składać się z dokładnie 11 cyfr.' }
  }

  // Weryfikacja sumy kontrolnej
  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3]
  let sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i], 10) * weights[i]
  }
  const controlDigit = (10 - (sum % 10)) % 10
  if (controlDigit !== parseInt(cleaned[10], 10)) {
    return { valid: false, error: 'Nieprawidłowa suma kontrolna numeru PESEL.' }
  }

  let year = parseInt(cleaned.substring(0, 2), 10)
  let month = parseInt(cleaned.substring(2, 4), 10)
  const day = parseInt(cleaned.substring(4, 6), 10)

  if (month > 80 && month <= 92) {
    year += 1800
    month -= 80
  } else if (month > 60 && month <= 72) {
    year += 2200
    month -= 60
  } else if (month > 40 && month <= 52) {
    year += 2100
    month -= 40
  } else if (month > 20 && month <= 32) {
    year += 2000
    month -= 20
  } else if (month >= 1 && month <= 12) {
    year += 1900
  } else {
    return { valid: false, error: 'Nieprawidłowy miesiąc w numerze PESEL.' }
  }

  const mm = month.toString().padStart(2, '0')
  const dd = day.toString().padStart(2, '0')
  const birthDate = `${year}-${mm}-${dd}`

  const genderDigit = parseInt(cleaned[9], 10)
  const isFemale = genderDigit % 2 === 0
  const gender: 'M' | 'F' = isFemale ? 'F' : 'M'
  const genderLabel = isFemale ? 'Kobieta' : 'Mężczyzna'

  return {
    valid: true,
    birthDate,
    gender,
    genderLabel,
  }
}

export interface BedCandidate {
  bedId: string
  bedNumber: string
  roomId: string
  roomNumber: string
  floorNumber: number
  capacity: number
  currentOccupants: Array<{ gender: string }>
}

export interface BedSuggestion {
  bedId: string
  bedNumber: string
  roomNumber: string
  floorNumber: number
  score: number
  reason: string
}

export function suggestBeds(
  candidates: BedCandidate[],
  resident: { gender: 'M' | 'F'; careLevel?: 'walking' | 'sitting' | 'bedridden' | 'hospice' }
): BedSuggestion[] {
  const suggestions: BedSuggestion[] = []

  for (const bed of candidates) {
    let score = 100
    const reasons: string[] = []

    // 1. Zgodność płci w pokoju
    const occupiedGenders = bed.currentOccupants.map((o) => o.gender)
    const hasDifferentGender = occupiedGenders.some((g) => g !== resident.gender)
    const hasSameGender = occupiedGenders.some((g) => g === resident.gender)

    if (hasDifferentGender) {
      score -= 80
      reasons.push('Uwaga: w pokoju przebywa osoba odmiennej płci.')
    } else if (hasSameGender) {
      score += 20
      reasons.push('Zgodność płci z dotychczasowymi lokatorami pokoju.')
    } else {
      reasons.push('Pokój obecnie wolny.')
    }

    // 2. Piętro i poziom opieki (parter preferowany dla leżących / hospicyjnych)
    if (resident.careLevel === 'bedridden' || resident.careLevel === 'hospice') {
      if (bed.floorNumber === 0) {
        score += 30
        reasons.push('Parter — optymalny dla pensjonariusza leżącego.')
      } else {
        score -= 20
        reasons.push('Wyższe piętro — pensjonariusz o ograniczonej mobilności.')
      }
    } else {
      reasons.push(`Piętro ${bed.floorNumber}.`)
    }

    suggestions.push({
      bedId: bed.bedId,
      bedNumber: bed.bedNumber,
      roomNumber: bed.roomNumber,
      floorNumber: bed.floorNumber,
      score,
      reason: reasons.join(' '),
    })
  }

  return suggestions.sort((a, b) => b.score - a.score)
}
