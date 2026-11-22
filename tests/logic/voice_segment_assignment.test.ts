import { describe, expect, it } from 'vitest'
import { assignVoiceSegment, type AssignmentResident } from '../../apps/web/src/lib/voice-segment-assignment'

const residents: AssignmentResident[] = [
  { id: 'a', firstName: 'Anna', lastName: 'Kowalska', room: '12', bed: 'A' },
  { id: 'b', firstName: 'Ewa', lastName: 'Kowalska', room: '12', bed: 'B' },
  { id: 'c', firstName: 'Jan', lastName: 'Żółć', room: '14', bed: 'A' },
]
const known = { authorId: 'nurse', timeCertain: true }

describe('Przypisanie fragmentu', () => {
  it('ustala jednego podopiecznego po zgodnych przesłankach @REQ: VOICE-RESIDENT-ASSIGN', () => {
    expect(assignVoiceSegment({ ...known, text: 'Pokój 12, łóżko B, Kowalska poszła na spacer' }, residents))
      .toEqual({ scope: 'RESIDENT', residentId: 'b' })
    expect(assignVoiceSegment({ ...known, text: 'Jan Zolc odebrał posiłek' }, residents))
      .toEqual({ scope: 'RESIDENT', residentId: 'c' })
  })

  it('trzyma w kolejce kolizje, nierozpoznane i mieszane fragmenty @REQ: VOICE-RESIDENT-ASSIGN', () => {
    expect(assignVoiceSegment({ ...known, text: 'Kowalska jadła obiad' }, residents))
      .toEqual({ scope: 'PENDING', reasons: ['MULTIPLE_MATCHES'], candidateIds: ['a', 'b'] })
    expect(assignVoiceSegment({ ...known, text: 'Pokój 12, Jan Żółć dostał herbatę' }, residents))
      .toMatchObject({ scope: 'PENDING', reasons: ['CONFLICTING_EVIDENCE'] })
    expect(assignVoiceSegment({ ...known, text: 'Anna Kowalska i Jan Żółć byli na spacerze' }, residents))
      .toMatchObject({ scope: 'PENDING', reasons: ['MIXED_SEGMENT'] })
    expect(assignVoiceSegment({ ...known, text: 'Podano obiad' }, residents))
      .toMatchObject({ scope: 'PENDING', reasons: ['NO_MATCH'] })
  })

  it('oddziela stanowisko aplikacji od ogólnego zakresu i niejasnego autora @REQ: VOICE-ZERO-GUESSING', () => {
    expect(assignVoiceSegment({ ...known, text: 'Otworzono okno', selectedResidentId: 'a' }, residents))
      .toEqual({ scope: 'RESIDENT', residentId: 'a' })
    expect(assignVoiceSegment({ ...known, text: 'Jan Żółć na spacerze', selectedResidentId: 'a' }, residents))
      .toMatchObject({ scope: 'PENDING', reasons: ['CONFLICTING_EVIDENCE'] })
    expect(assignVoiceSegment({ ...known, text: 'Sprawa placówki. Winda nie działa.' }, residents))
      .toEqual({ scope: 'FACILITY' })
    expect(assignVoiceSegment({ authorId: null, timeCertain: false, text: 'Jan Żółć na spacerze' }, residents))
      .toMatchObject({ scope: 'PENDING', reasons: ['NO_AUTHOR', 'TIME_UNCERTAIN'], candidateIds: ['c'] })
  })
})
