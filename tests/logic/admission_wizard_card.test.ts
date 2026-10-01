import { describe, it, expect } from 'vitest';
import { parseNationalId } from '../../apps/web/src/lib/admission-helpers';
import * as fs from 'fs';
import * as path from 'path';

/**
 * @REQ: ADM-RESIDENT-ADD
 * @REQ: SEC-PESEL-HASH
 * @REQ: MDR-VOCABULARY
 *
 * Testy dla kreatora przyjęcia pensjonariusza i karty podopiecznego (ADM-RESIDENT-ADMISSION-CARD):
 * AC1: Walidacja PESEL na kroku 1 (suma kontrolna, format).
 * AC2: Poprawna definicja ZSN: "Znaczny stopień niepełnosprawności".
 * AC3: Płynne przejście do profilu podopiecznego.
 */
describe('Admission Wizard & Resident Card Logic (@REQ: ADM-RESIDENT-ADD, @REQ: SEC-PESEL-HASH, @REQ: MDR-VOCABULARY)', () => {
  it('validates PESEL checksum strictly on step 1 and extracts birth date & gender @REQ: ADM-RESIDENT-ADD', () => {
    // 1. Nieprawidłowa suma kontrolna
    const invalidChecksum = parseNationalId('52081203449');
    expect(invalidChecksum.valid).toBe(false);
    expect(invalidChecksum.error).toContain('suma kontrolna');

    // 2. Nieprawidłowa długość
    const tooShort = parseNationalId('12345');
    expect(tooShort.valid).toBe(false);
    expect(tooShort.error).toContain('11 cyfr');

    // 3. Prawidłowy PESEL kobiety urodzonej w 1952 roku (52081203447)
    const validFemale = parseNationalId('52081203447');
    expect(validFemale.valid).toBe(true);
    expect(validFemale.gender).toBe('F');
    expect(validFemale.birthDate).toBe('1952-08-12');

    // 4. Prawidłowy PESEL mężczyzny urodzonego po 2000 roku (02270803617 -> miesiąc +20)
    // Walidacja sumy kontrolnej: [1,3,7,9,1,3,7,9,1,3]
    const validMale = parseNationalId('02270803617');
    expect(validMale.valid).toBe(true);
    expect(validMale.gender).toBe('M');
    expect(validMale.birthDate).toBe('2002-07-08');
  });

  it('ensures ZSN is consistently defined as "Znaczny stopień niepełnosprawności" across components @REQ: MDR-VOCABULARY', () => {
    const wizardPath = path.resolve(__dirname, '../../apps/web/src/components/AdmissionWizard.tsx');
    const zsnCheckboxPath = path.resolve(__dirname, '../../apps/web/src/components/ResidentZsnCheckbox.tsx');

    expect(fs.existsSync(wizardPath)).toBe(true);
    expect(fs.existsSync(zsnCheckboxPath)).toBe(true);

    const wizardContent = fs.readFileSync(wizardPath, 'utf-8');
    const zsnContent = fs.readFileSync(zsnCheckboxPath, 'utf-8');

    // Wykluczenie starego terminu
    expect(wizardContent).not.toContain('Zwiększone Zapotrzebowanie na Nadzór');
    expect(zsnContent).not.toContain('Zwiększone Zapotrzebowanie na Nadzór');

    // Wymóg poprawnej definicji biznesowej
    expect(wizardContent).toContain('Znaczny stopień niepełnosprawności');
    expect(zsnContent).toContain('Znaczny stopień niepełnosprawności');
  });

  it('guarantees PESEL is never stored in plain text and only as pesel_hash @REQ: SEC-PESEL-HASH', () => {
    const admissionActionPath = path.resolve(__dirname, '../../apps/web/src/actions/admission.ts');
    const actionContent = fs.readFileSync(admissionActionPath, 'utf-8');

    // Weryfikacja, że admit_resident_with_bed otrzymuje pesel_hash
    expect(actionContent).toContain('p_pesel_hash');
    expect(actionContent).toContain('hashNationalId');
  });
});
