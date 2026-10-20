import { describe, it, expect } from 'vitest'
import { resolveVoiceResidentContext, getVoiceRoute } from '../../apps/web/src/lib/voice-navigation'
import { getStaffNavGroups } from '../../apps/web/src/components/StaffSidebar'

describe('VOICE-RESIDENT-FALLBACK-NAVIGATION: Nawigacja i fallback wyboru podopiecznego', () => {

  it('StaffSidebar udostępnia nawigację do Notatki głosowej w grupie Dyżur @REQ: VOICE-ZERO-GUESSING', () => {
    const groups = getStaffNavGroups(0)
    const dutyGroup = groups.find((g) => g.label === 'Dyżur')
    expect(dutyGroup).toBeDefined()

    const voiceItem = dutyGroup?.items.find((item) => item.href === '/voice')
    expect(voiceItem).toBeDefined()
    expect(voiceItem?.label).toBe('Notatka głosowa')
  })

  it('rozwiązuje kontekst podopiecznego gdy resident_id jest obecny w parametrach @REQ: VOICE-ZERO-GUESSING', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000'

    // Obiekt z parametrem
    const contextFromObj = resolveVoiceResidentContext({ resident: validUuid })
    expect(contextFromObj.hasResident).toBe(true)
    expect(contextFromObj.residentId).toBe(validUuid)
    expect(contextFromObj.mode).toBe('record')
    expect(contextFromObj.returnUrl).toBe('/staff')

    // Instancja URLSearchParams
    const searchParams = new URLSearchParams(`resident=${validUuid}`)
    const contextFromParams = resolveVoiceResidentContext(searchParams)
    expect(contextFromParams.hasResident).toBe(true)
    expect(contextFromParams.residentId).toBe(validUuid)
    expect(contextFromParams.mode).toBe('record')
  })

  it('bezpiecznie przełącza w tryb wyboru podopiecznego gdy brak parametru resident (fallback) @REQ: VOICE-ZERO-GUESSING', () => {
    // Brak parametrów (null)
    const contextNull = resolveVoiceResidentContext(null)
    expect(contextNull.hasResident).toBe(false)
    expect(contextNull.residentId).toBeNull()
    expect(contextNull.mode).toBe('select_resident')
    expect(contextNull.returnUrl).toBe('/staff')

    // Pusty obiekt parametrów
    const contextEmpty = resolveVoiceResidentContext({})
    expect(contextEmpty.hasResident).toBe(false)
    expect(contextEmpty.residentId).toBeNull()
    expect(contextEmpty.mode).toBe('select_resident')

    // Parametr będący pustym stringiem ze spacjami
    const contextWhitespace = resolveVoiceResidentContext({ resident: '   ' })
    expect(contextWhitespace.hasResident).toBe(false)
    expect(contextWhitespace.residentId).toBeNull()
    expect(contextWhitespace.mode).toBe('select_resident')
  })

  it('generuje poprawne trasy URL dla notatki głosowej @REQ: VOICE-ZERO-GUESSING', () => {
    expect(getVoiceRoute('550e8400-e29b-41d4-a716-446655440000')).toBe('/voice?resident=550e8400-e29b-41d4-a716-446655440000')
    expect(getVoiceRoute(null)).toBe('/voice')
    expect(getVoiceRoute('')).toBe('/voice')
  })

})
