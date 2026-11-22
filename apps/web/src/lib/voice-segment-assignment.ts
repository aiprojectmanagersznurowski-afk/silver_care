import { RESIDENT_ASSIGNMENT } from '@silvercare/contracts/src/generated/voice'

export interface AssignmentResident {
  id: string
  firstName: string
  lastName: string
  room: string | null
  bed: string | null
}

interface AssignmentContext {
  text: string
  authorId: string | null
  timeCertain: boolean
  selectedResidentId?: string
}

type ReviewReason = (typeof RESIDENT_ASSIGNMENT.reviewReasons)[number]

export type SegmentAssignment =
  | { scope: 'RESIDENT'; residentId: string }
  | { scope: 'FACILITY' }
  | { scope: 'PENDING'; reasons: ReviewReason[]; candidateIds: string[] }

function normalize(value: string) {
  return value.toLocaleLowerCase('pl').normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/ł/g, 'l').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function hasWords(text: string, value: string) {
  return value.length > 0 && ` ${text} `.includes(` ${value} `)
}

function uniqueMatches(text: string, pattern: RegExp) {
  return [...new Set([...text.matchAll(pattern)].map((match) => match[1]))]
}

function pending(reasons: ReviewReason[], residents: AssignmentResident[]): SegmentAssignment {
  return { scope: 'PENDING', reasons, candidateIds: [...new Set(residents.map(({ id }) => id))].sort() }
}

export function assignVoiceSegment(input: AssignmentContext, residents: AssignmentResident[]): SegmentAssignment {
  const text = normalize(input.text)
  const named = residents.filter(({ lastName }) => hasWords(text, normalize(lastName)))
  const fullName = named.filter(({ firstName, lastName }) =>
    hasWords(text, normalize(`${firstName} ${lastName}`)) || hasWords(text, normalize(`${lastName} ${firstName}`)))
  const exactSurnames = new Set(fullName.map(({ lastName }) => normalize(lastName)))
  const nameMatches = [...fullName, ...named.filter(({ lastName }) => !exactSurnames.has(normalize(lastName)))]
  const rooms = uniqueMatches(text, /\b(?:pokoj|pokoju) ([\p{L}\p{N}]+)/gu)
  const beds = uniqueMatches(text, /\b(?:lozko|lozku|lozka) ([\p{L}\p{N}]+)/gu)
  const facility = hasWords(text, 'sprawa placowki')
  const roomMatches = residents.filter(({ room }) => room && rooms.includes(normalize(room)))
  const bedMatches = residents.filter(({ bed }) => bed && beds.includes(normalize(bed)))
  const selected = residents.filter(({ id }) => id === input.selectedResidentId)

  const reasons: ReviewReason[] = []
  if (!input.authorId) reasons.push('NO_AUTHOR')
  if (!input.timeCertain) reasons.push('TIME_UNCERTAIN')

  if (fullName.length > 1 || new Set(nameMatches.map(({ lastName }) => normalize(lastName))).size > 1
    || rooms.length > 1 || beds.length > 1) {
    return pending(['MIXED_SEGMENT', ...reasons], [...nameMatches, ...roomMatches, ...selected])
  }

  const evidence: AssignmentResident[][] = []
  if (input.selectedResidentId) evidence.push(selected)
  if (nameMatches.length) evidence.push(nameMatches)
  if (rooms.length) evidence.push(roomMatches)
  if (beds.length) evidence.push(bedMatches)

  const candidates = evidence.length
    ? residents.filter(({ id }) => evidence.every((group) => group.some((resident) => resident.id === id)))
    : []
  if (facility && evidence.length) {
    return pending(['CONFLICTING_EVIDENCE', ...reasons], evidence.flat())
  }
  if (facility) return reasons.length ? pending(reasons, []) : { scope: 'FACILITY' }
  if (!candidates.length) {
    return pending([evidence.some((group) => group.length) && evidence.length > 1
      ? 'CONFLICTING_EVIDENCE' : 'NO_MATCH', ...reasons], evidence.flat())
  }
  if (candidates.length > 1) return pending(['MULTIPLE_MATCHES', ...reasons], candidates)
  if (reasons.length) return pending(reasons, candidates)
  return { scope: 'RESIDENT', residentId: candidates[0].id }
}
