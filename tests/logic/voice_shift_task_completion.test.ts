import { describe, expect, it } from 'vitest'
import { matchVoiceTaskCompletion } from '@/lib/voice-shift-task-completion'

const room = { id: 'room', title: 'Przewietrzyć świetlicę' }
const meal = { id: 'meal', title: 'Pomóc przy kolacji' }
const candidates = [room, meal]

describe('Regułowe rozliczenie głosowe', () => {
  it.each([
    ['Przewietrzyłam świetlicę.', 'room', 'COMPLETED'],
    ['Nie przewietrzyłam świetlicy.', 'room', 'NOT_COMPLETED'],
    ['Pani odmówiła kolacji.', 'meal', 'REFUSED'],
    ['Wykonano zadanie: Przewietrzyć świetlicę.', 'room', 'COMPLETED'],
  ])('@REQ: NUR-TASKS-VOICE-COMPLETION dopasowuje %s', (quote, taskId, kind) => {
    expect(matchVoiceTaskCompletion(quote, candidates)).toEqual([{ taskId, kind, fragmentIndex: 0, quote }])
  })

  it.each([
    'Jak będzie czas, przewietrzę świetlicę.',
    'Na następną zmianę trzeba przewietrzyć świetlicę.',
    'Nie wiem, czy przewietrzyłam świetlicę.',
    'Przewietrzyłam świetlicę?',
    'Przewietrzyłam świetlicę, chyba.',
    'Miałam przewietrzyć świetlicę.',
    'Przewietrzyłam świetlicę na piętrze.',
    'Brak wzmianki.',
  ])('@REQ: NUR-TASKS-VOICE-COMPLETION pomija %s', (transcript) => {
    expect(matchVoiceTaskCompletion(transcript, candidates)).toEqual([])
  })

  it('@REQ: NUR-TASKS-VOICE-COMPLETION pomija niejednoznaczne zadania i zachowuje oba dowody konfliktu', () => {
    expect(matchVoiceTaskCompletion('Przewietrzyłam świetlicę.', [room, { ...room, id: 'other' }])).toEqual([])
    expect(matchVoiceTaskCompletion('Dobry wieczór. Przewietrzyłam świetlicę. Nie przewietrzyłam świetlicy.', candidates))
      .toEqual([
        { taskId: 'room', kind: 'COMPLETED', fragmentIndex: 1, quote: 'Przewietrzyłam świetlicę.' },
        { taskId: 'room', kind: 'NOT_COMPLETED', fragmentIndex: 2, quote: 'Nie przewietrzyłam świetlicy.' },
      ])
  })
})
