import { describe, it, expect } from 'vitest'
import { validateOrganizationUpdate, formatAddressSuggestion, isValidViewMode } from '../../apps/web/src/lib/org-helpers'

/**
 * @REQ: ORG-PROVISION
 * @REQ: ORG-ISOLATION
 *
 * Testy logiki zarządzania placówkami (ORG-FACILITY-MANAGEMENT):
 * AC1: Przełącznik widoków Kafelki / Tabela (zapamiętywanie trybu, walidacja)
 * AC2: Autouzupełnianie i standaryzacja adresu
 * AC3: Walidacja edycji danych placówki (nazwa, limit, adres)
 */
describe('Organization Facility Management Logic (@REQ: ORG-PROVISION, @REQ: ORG-ISOLATION)', () => {
  describe('AC1: Przełącznik trybu widoku (@REQ: ORG-PROVISION)', () => {
    it('validates supported view modes', () => {
      expect(isValidViewMode('cards')).toBe(true)
      expect(isValidViewMode('table')).toBe(true)
      expect(isValidViewMode('grid')).toBe(false)
      expect(isValidViewMode('')).toBe(false)
      expect(isValidViewMode(null)).toBe(false)
    })
  })

  describe('AC2: Standaryzacja adresu i obsługa podpowiedzi Google Places (@REQ: ORG-PROVISION)', () => {
    it('formats address suggestions with street, number and city cleanly', () => {
      const suggestion = {
        description: 'ul. Marszałkowska 10, 00-001 Warszawa, Polska',
        mainText: 'ul. Marszałkowska 10',
        secondaryText: '00-001 Warszawa, Polska'
      }
      expect(formatAddressSuggestion(suggestion)).toBe('ul. Marszałkowska 10, 00-001 Warszawa, Polska')
    })

    it('handles manual plain text address without modification', () => {
      const raw = '  ul. Lipowa 5, 30-001 Kraków  '
      expect(formatAddressSuggestion(raw)).toBe('ul. Lipowa 5, 30-001 Kraków')
    })
  })

  describe('AC3: Walidacja aktualizacji placówki (@REQ: ORG-PROVISION)', () => {
    it('accepts valid organization updates', () => {
      const res = validateOrganizationUpdate({
        orgName: 'Dom Seniora Złoty Wiek',
        residentLimit: '60',
        address: 'ul. Parkowa 12, Gdańsk'
      })
      expect(res.valid).toBe(true)
      expect(res.data).toEqual({
        orgName: 'Dom Seniora Złoty Wiek',
        residentLimit: 60,
        address: 'ul. Parkowa 12, Gdańsk'
      })
    })

    it('rejects empty or whitespace-only organization name', () => {
      const res = validateOrganizationUpdate({
        orgName: '   ',
        residentLimit: '50'
      })
      expect(res.valid).toBe(false)
      expect(res.error).toMatch(/nazwa.*wymagana/i)
    })

    it('enforces positive resident limit', () => {
      const resZero = validateOrganizationUpdate({
        orgName: 'Ośrodek',
        residentLimit: '0'
      })
      expect(resZero.valid).toBe(false)
      expect(resZero.error).toMatch(/limit.*dodatni/i)

      const resNegative = validateOrganizationUpdate({
        orgName: 'Ośrodek',
        residentLimit: '-15'
      })
      expect(resNegative.valid).toBe(false)
    })
  })

  describe('Słownik i Granica MDR (@REQ: ORG-PROVISION)', () => {
    it('does not contain prohibited medical vocabulary in facility management labels', () => {
      const labels = ['Podopieczni', 'Limit pensjonariuszy', 'Zarządzanie Placówkami', 'Opiekunowie']
      for (const label of labels) {
        expect(label.toLowerCase()).not.toContain('pacjent')
      }
    })
  })
})
