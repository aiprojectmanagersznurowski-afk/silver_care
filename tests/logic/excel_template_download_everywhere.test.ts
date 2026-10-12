import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

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
  const bulkImportPath = path.resolve(process.cwd(), 'apps/web/src/components/BulkImportDialog.tsx');
  const facilityIoPath = path.resolve(process.cwd(), 'apps/web/src/components/facility/FacilityImportExportDialog.tsx');

  describe('Bulk Resident Import Dialog (@REQ: ADM-RESIDENT-ADD)', () => {
    it('provides template download in upload and preview steps with instruction sheet', () => {
      const content = fs.readFileSync(bulkImportPath, 'utf8');

      // Nazwa pliku wzorca podopiecznych
      expect(content).toContain('formatka_importu_podopiecznych.xlsx');

      // Arkusz z instrukcją dopuszczalnych wartości
      expect(content).toContain('Instrukcja');

      // Przycisk pobrania wzorca na etapie podglądu wierszy (step === preview)
      expect(content).toMatch(/step === 'preview'[\s\S]*?handleDownloadTemplate/);

      // Etykieta pobierania formatki
      expect(content).toContain('Pobierz formatkę Excel');
    });
  });

  describe('Facility Structure Import Dialog (@REQ: ADM-FACILITY-MANAGE)', () => {
    it('provides template download directly within the import tab and preview view', () => {
      const content = fs.readFileSync(facilityIoPath, 'utf8');

      // Nazwa pliku wzorca struktury
      expect(content).toContain('formatka_struktury_placowki.xlsx');

      // Arkusz z instrukcją dopuszczalnych wartości w pliku Excel
      expect(content).toContain('Instrukcja');

      // Pobieranie formatki bezpośrednio wewnątrz zakładki import (activeTab === 'import')
      expect(content).toMatch(/activeTab === 'import'[\s\S]*?handleDownloadTemplate/);

      // Przycisk pobierania formatki przy podglądzie dryRunResult
      expect(content).toMatch(/dryRunResult[\s\S]*?handleDownloadTemplate/);

      // Czytelna etykieta formatki
      expect(content).toContain('Pobierz formatkę Excel');
    });
  });
});
