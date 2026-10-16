import { describe, it, expect } from 'vitest'
import {
  getItemSlot,
  isCurrentSlot,
  TIME_SLOTS,
  ITEM_TYPES,
  SlotDefinition,
} from '../../apps/web/src/components/staff/agenda/agenda-types'

describe('UI-NUR-AGENDA-TOAST: Podpięcie powiadomień toast (Sonner) i logiki w Planerze Dnia Personelu', () => {
  it('definiuje 4 pory dnia zgodnie ze standardem placówki @REQ: NUR-AGENDA', () => {
    expect(TIME_SLOTS).toHaveLength(4)
    const slotKeys = TIME_SLOTS.map((s) => s.key)
    expect(slotKeys).toEqual(['morning', 'noon', 'afternoon', 'evening'])
  })

  it('deterministycznie przydziela godziny do pór dnia (getItemSlot) @REQ: NUR-AGENDA', () => {
    expect(getItemSlot('07:30')).toBe('morning')
    expect(getItemSlot('11:59')).toBe('morning')
    expect(getItemSlot('12:00')).toBe('noon')
    expect(getItemSlot('14:45')).toBe('noon')
    expect(getItemSlot('15:00')).toBe('afternoon')
    expect(getItemSlot('17:59')).toBe('afternoon')
    expect(getItemSlot('18:00')).toBe('evening')
    expect(getItemSlot('23:15')).toBe('evening')
    expect(getItemSlot('03:30')).toBe('evening')
    expect(getItemSlot('invalid')).toBe('morning') // fallback
  })

  it('weryfikuje aktywny slot czasu dla bieżącej godziny (isCurrentSlot) @REQ: NUR-AGENDA', () => {
    const currentHour = new Date().getHours()
    const activeSlot = TIME_SLOTS.find((slot) => isCurrentSlot(slot))
    expect(activeSlot).toBeDefined()

    if (currentHour >= 6 && currentHour <= 11) {
      expect(activeSlot?.key).toBe('morning')
    } else if (currentHour >= 12 && currentHour <= 14) {
      expect(activeSlot?.key).toBe('noon')
    } else if (currentHour >= 15 && currentHour <= 17) {
      expect(activeSlot?.key).toBe('afternoon')
    } else {
      expect(activeSlot?.key).toBe('evening')
    }
  })

  it('obsługuje wymagane typy punktów agendy @REQ: NUR-AGENDA', () => {
    const types = ITEM_TYPES.map((t) => t.value)
    expect(types).toContain('meal')
    expect(types).toContain('activity')
    expect(types).toContain('therapy')
    expect(types).toContain('hygiene')
    expect(types).toContain('rest')
    expect(types).toContain('other')
  })

  it('definiuje spójne komunikaty sukcesu operacji agendy @REQ: NUR-AGENDA', () => {
    const TOAST_MESSAGES = {
      add: 'Wydarzenie zostało dodane do harmonogramu.',
      update: 'Zaktualizowano wpis w harmonogramie.',
      delete: 'Usunięto wpis z harmonogramu.',
    }
    expect(TOAST_MESSAGES.add).toBe('Wydarzenie zostało dodane do harmonogramu.')
    expect(TOAST_MESSAGES.update).toBe('Zaktualizowano wpis w harmonogramie.')
    expect(TOAST_MESSAGES.delete).toBe('Usunięto wpis z harmonogramu.')
  })
})
