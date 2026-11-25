import { SHIFT_TASK_VOICE } from '@silvercare/contracts/src/generated/roles'

type EvidenceKind = (typeof SHIFT_TASK_VOICE.evidenceKinds)[number]
type Candidate = { id: string; title: string }
type Mention = { fragmentIndex: number; quote: string; kind: EvidenceKind; titles: readonly string[] }

const sentences = new Intl.Segmenter('pl', { granularity: 'sentence' })
const explicitTask = /^(wykonałam|wykonałem|wykonano) zadanie\s*[:–—-]\s*(.+)$/u
const explicitNegation = /^nie (wykonałam|wykonałem|wykonano) zadania\s*[:–—-]\s*(.+)$/u
const refusal = /^(?:(?:(?:pani|pan)(?: \[osoba\])?|podopieczna|podopieczny|\[osoba\]) )?odmówi(?:ła|ł) (śniadania|obiadu|kolacji)$/u

const mealTasks: Record<string, readonly string[]> = {
  śniadania: ['śniadanie', 'podać śniadanie', 'pomóc przy śniadaniu'],
  obiadu: ['obiad', 'podać obiad', 'pomóc przy obiedzie'],
  kolacji: ['kolacja', 'podać kolację', 'pomóc przy kolacji'],
}

const completedVerb = [
  [/^przewietrzy(?:łam|łem|liśmy|łyśmy|ono)$/u, 'przewietrzyć'],
  [/^posprząta(?:łam|łem|liśmy|łyśmy|no)$/u, 'posprzątać'],
  [/^uporządkowa(?:łam|łem|liśmy|łyśmy|no)$/u, 'uporządkować'],
  [/^podla(?:łam|łem|liśmy|łyśmy|no)$/u, 'podlać'],
  [/^nakry(?:łam|łem|liśmy|łyśmy|to)$/u, 'nakryć'],
  [/^zanios(?:łam|łem|łyśmy|ło|iono)$/u, 'zanieść'],
  [/^zmieni(?:łam|łem|liśmy|łyśmy|ono)$/u, 'zmienić'],
] as const

const objects: Record<string, string> = {
  świetlicy: 'świetlicę',
  stołówki: 'stołówkę',
  pościeli: 'pościel',
}

function normalize(text: string) {
  return text.normalize('NFC').trim().toLocaleLowerCase('pl').replace(/[.!]+$/u, '').replace(/\s+/gu, ' ')
}

function classifyMention(quote: string): Pick<Mention, 'kind' | 'titles'> | undefined {
  if (!quote || quote.length > SHIFT_TASK_VOICE.maxQuoteLength || quote.includes('?')) return
  const text = normalize(quote).replace(/^sprawa placówki\s*[:–—-]\s*/u, '')
  const exact = explicitTask.exec(text) ?? explicitNegation.exec(text)
  if (exact) {
    return { kind: text.startsWith('nie ') ? 'NOT_COMPLETED' : 'COMPLETED', titles: [normalize(exact[2])] }
  }
  const refusedMeal = refusal.exec(text)?.[1]
  if (refusedMeal) return { kind: 'REFUSED', titles: mealTasks[refusedMeal] }

  const negated = text.startsWith('nie ')
  const [verb, ...rest] = (negated ? text.slice(4) : text).split(' ')
  const infinitive = completedVerb.find(([pattern]) => pattern.test(verb))?.[1]
  if (!infinitive || rest.length === 0 || rest.some((word) => !/^\p{L}+$/u.test(word))) return
  const object = rest.join(' ')
  return { kind: negated ? 'NOT_COMPLETED' : 'COMPLETED', titles: [`${infinitive} ${objects[object] ?? object}`] }
}

function readMentions(transcript: string): Mention[] {
  return Array.from(sentences.segment(transcript)).flatMap(({ segment }, fragmentIndex) => {
    const quote = segment.trim()
    const content = classifyMention(quote)
    return content ? [{ fragmentIndex, quote, ...content }] : []
  })
}

export function matchVoiceTaskCompletion(sanitizedText: string, candidates: readonly Candidate[]) {
  const titled = candidates.map(({ id, title }) => ({ id, title: normalize(title) }))
  return readMentions(sanitizedText).flatMap(({ titles, ...evidence }) => {
    const matches = titled.filter(({ title }) => titles.includes(title))
    return matches.length === 1 ? [{ taskId: matches[0].id, ...evidence }] : []
  })
}

export function omitVoiceTaskCompletion(transcript: string) {
  return Array.from(sentences.segment(transcript))
    .filter(({ segment }) => !classifyMention(segment.trim()))
    .map(({ segment }) => segment)
    .join('')
    .trim()
}
