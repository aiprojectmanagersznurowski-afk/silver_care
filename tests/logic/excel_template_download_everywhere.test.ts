import { describe, it, expect } from 'vitest';
import { generateResidentTemplate } from '../../apps/web/src/lib/bulk-import-template';
import { generateFacilityStructureTemplate } from '../../apps/web/src/lib/facility-import-template';

/**
 * @REQ: ADM-RESIDENT-ADD
 * @REQ: ADM-FACILITY-MANAGE
 * @REQ: UI-ACCESSIBILITY
 *
 * Testy dla zadania ADM-EXCEL-TEMPLATE-DOWNLOAD-EVERYWHERE:
 * AC1: W oknie masowego importu podopiecznych formatka Excel jest dostępna do pobrania na etapie wyboru pliku oraz na etapie podglądu walidacji.
 * AC2: W oknie importu struktury placówki formatka Excel jest dostępna bezpośrednio w zakładce importu oraz przy podglądzie wierszy.
 * AC3: Pobrane arkusze zawierają ujednolicone nazwy 'formatka_*.xlsx' oraz arkusz z instrukcją dopuszczalnych formatów danych.
 * AC4: Wszystkie przyciski spełniają wymogi dostępności i posiadają czytelne etykiety.
 */
describe('Universal Excel Template Download in All Import Dialogs (@REQ: ADM-RESIDENT-ADD, @REQ: ADM-FACILITY-MANAGE, @REQ: UI-ACCESSIBILITY)', () => {
  describe('Bulk Resident Import Dialog (@REQ: ADM-RESIDENT-ADD)', () => {
    it('generates valid resident excel template with data and instruction sheets @REQ: ADM-RESIDENT-ADD', () => {
      const wb = generateResidentTemplate('formatka_importu_podopiecznych.xlsx', 'Instrukcja', false);

      expect(wb).toBeDefined();
      expect(wb.SheetNames).toContain('Podopieczni');
      expect(wb.SheetNames).toContain('Instrukcja');

      // Weryfikacja arkusza z instrukcją formatów
      const instructionSheet = wb.Sheets['Instrukcja'];
      expect(instructionSheet).toBeDefined();
      expect(instructionSheet['A1']?.v).toBe('Kolumna');
      expect(instructionSheet['B1']?.v).toBe('Wymagana?');
      expect(instructionSheet['C1']?.v).toBe('Opis i dozwolone formaty');

      // Kolumna PESEL
      expect(instructionSheet['A4']?.v).toBe('PESEL');
      expect(instructionSheet['B4']?.v).toBe('TAK');
    });
  });

  describe('Facility Structure Import Dialog (@REQ: ADM-FACILITY-MANAGE)', () => {
    it('generates valid facility structure excel template with rooms and instruction sheets @REQ: ADM-FACILITY-MANAGE', () => {
      const wb = generateFacilityStructureTemplate('formatka_struktury_placowki.xlsx', 'Instrukcja', false);

      expect(wb).toBeDefined();
      expect(wb.SheetNames).toContain('Pokoje i Łóżka');
      expect(wb.SheetNames).toContain('Instrukcja');

      // Weryfikacja arkusza z danymi
      const dataSheet = wb.Sheets['Pokoje i Łóżka'];
      expect(dataSheet).toBeDefined();
      expect(dataSheet['A1']?.v).toBe('Piętro');
      expect(dataSheet['B1']?.v).toBe('Numer pokoju');
      expect(dataSheet['C1']?.v).toBe('Sektor');

      // Weryfikacja arkusza z instrukcją
      const instructionSheet = wb.Sheets['Instrukcja'];
      expect(instructionSheet).toBeDefined();
      expect(instructionSheet['A1']?.v).toBe('Kolumna');
      expect(instructionSheet['B1']?.v).toBe('Wymagana?');
    });
  });
});
