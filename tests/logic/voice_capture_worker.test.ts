import { describe, expect, it } from 'vitest'
import { planCaptureSegments } from '../../apps/web/src/lib/voice-capture-worker'

const registry = {
  residents: [{ id: 'resident', firstName: 'Maria', lastName: 'Las', room: '7', bed: '2' }],
  staff: [{ id: 'one', name: 'Łucja Żak' }, { id: 'two', name: 'Jan Krawiec' }],
  declared_author_id: null,
}
const clip = (text: string) => ({ start_ms: 0, end_ms: 1000, text })

describe('Plan fragmentów nagrania @REQ: VOICE-RESIDENT-ASSIGN', () => {
  it('łączy dopasowanie podopiecznego i deklarację autora, pomija samą deklarację @REQ: VOICE-RESIDENT-ASSIGN', () => {
    const plan = planCaptureSegments({ source: 'DEVICE', author_id: null, clock_state: 'SYNCED',
      session_seq: 1, selected_resident_id: null }, registry, [
      clip('Nazywam się Łucja Żak.'),
      { ...clip('Maria Las skończyła śniadanie.'), start_ms: 1000, end_ms: 2000 },
    ])
    expect(plan.declaration).toBe('one')
    expect(plan.segments).toEqual([expect.objectContaining({ scope: 'RESIDENT', resident_id: 'resident', author_id: 'one', ordinal: 1 })])
  })

  it('zachowuje treść po przedstawieniu w tym samym zdaniu @REQ: VOICE-RESIDENT-ASSIGN', () => {
    const plan = planCaptureSegments({ source: 'DEVICE', author_id: null, clock_state: 'SYNCED',
      session_seq: 1, selected_resident_id: null }, registry, [
      clip('Cześć, tu mówi Łucja Żak, Maria Las skończyła śniadanie.'),
    ])
    expect(plan.declaration).toBe('one')
    expect(plan.segments).toEqual([
      expect.objectContaining({ scope: 'RESIDENT', resident_id: 'resident', author_id: 'one', ordinal: 0 }),
    ])
  })

  it('pomija samo powitanie i przedstawienie @REQ: VOICE-RESIDENT-ASSIGN', () => {
    const plan = planCaptureSegments({ source: 'DEVICE', author_id: null, clock_state: 'SYNCED',
      session_seq: 1, selected_resident_id: null }, registry, [clip('Dzień dobry, tu mówi Łucja Żak.')])
    expect(plan.declaration).toBe('one')
    expect(plan.segments).toHaveLength(0)
  })

  it('wstrzymuje jawną deklarację bez dopasowania w już rozpoczętej sesji @REQ: VOICE-RESIDENT-ASSIGN', () => {
    const plan = planCaptureSegments({ source: 'DEVICE', author_id: null, clock_state: 'SYNCED',
      session_seq: 2, selected_resident_id: null }, { ...registry, declared_author_id: 'one' },
    [clip('Nazywam się Aleksandra Brzoza. Maria Las skończyła śniadanie.')])
    expect(plan.segments[0]).toMatchObject({ scope: 'PENDING', author_id: null,
      reasons: ['CONFLICTING_EVIDENCE', 'NO_AUTHOR'], candidate_ids: ['resident'] })
  })

  it('wstrzymuje fragment po innej deklaracji oraz odróżnia czas niepewny od czasu zapisu @REQ: VOICE-RESIDENT-ASSIGN', () => {
    const plan = planCaptureSegments({ source: 'DEVICE', author_id: null, clock_state: 'UNKNOWN',
      session_seq: 2, selected_resident_id: null }, { ...registry, declared_author_id: 'one' },
    [clip('Nazywam się Jan Krawiec. Maria Las skończyła śniadanie.')])
    expect(plan.declaration).toBeNull()
    expect(plan.segments[0]).toMatchObject({ scope: 'PENDING', author_id: null,
      reasons: ['CONFLICTING_EVIDENCE', 'NO_AUTHOR', 'TIME_UNCERTAIN'], candidate_ids: ['resident'] })
  })
})
