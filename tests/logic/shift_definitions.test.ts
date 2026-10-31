import { describe, it, expect } from 'vitest';
import { SHIFT_POLICY } from '../../packages/contracts/src/generated/facility';
import { validateShiftDefinitionInput, formatShiftRange, shiftCountStatus } from '../../apps/web/src/lib/shifts/shift-definitions';

/**
 * @REQ: NUR-SHIFT-CONFIG
 *
 * SC-NUR-12/AC1: placówka ma 2 albo 3 zmiany na dobę (SHIFT_POLICY), zmiana nocna przechodzi przez północ.
 * Logika walidacji formularza i opisu zmian jest czysta; granice liczby zmian pochodzą z kontraktu.
 */
describe('Definicje zmian (NUR-SHIFT-CONFIG)', () => {
  it('@REQ: NUR-SHIFT-CONFIG - poprawna zmiana dzienna i nocna; kod wynika z nazwy', () => {
    const day = validateShiftDefinitionInput({ name: 'Zmiana dzienna', startTime: '07:00', endTime: '19:00' });
    expect(day).toMatchObject({ valid: true, data: { name: 'Zmiana dzienna', startTime: '07:00', endTime: '19:00' } });
    expect(day.valid && day.data.code).toBe('ZMIANA-DZIENNA');

    const night = validateShiftDefinitionInput({ name: 'Nocna', startTime: '19:00', endTime: '07:00' });
    expect(night.valid).toBe(true);
  });

  it('@REQ: NUR-SHIFT-CONFIG - odrzuca puste nazwy, błędne godziny i zmianę bez długości', () => {
    expect(validateShiftDefinitionInput({ name: '  ', startTime: '07:00', endTime: '19:00' })).toMatchObject({ valid: false });
    expect(validateShiftDefinitionInput({ name: 'X'.repeat(41), startTime: '07:00', endTime: '19:00' })).toMatchObject({ valid: false });
    expect(validateShiftDefinitionInput({ name: 'A', startTime: '7:00', endTime: '19:00' })).toMatchObject({ valid: false });
    expect(validateShiftDefinitionInput({ name: 'A', startTime: '24:00', endTime: '19:00' })).toMatchObject({ valid: false });
    expect(validateShiftDefinitionInput({ name: 'A', startTime: '08:30', endTime: '08:30' })).toMatchObject({ valid: false });
  });

  it('@REQ: NUR-SHIFT-CONFIG - opis godzin zaznacza przejście przez północ', () => {
    expect(formatShiftRange('07:00', '19:00')).toBe('07:00–19:00');
    expect(formatShiftRange('19:00', '07:00')).toBe('19:00–07:00 (przez północ)');
  });

  it('@REQ: NUR-SHIFT-CONFIG - liczba aktywnych zmian wobec granic z kontraktu', () => {
    expect(SHIFT_POLICY.shiftsPerDay).toEqual({ min: 2, max: 3 });
    expect(shiftCountStatus(0)).toBe('too_few');
    expect(shiftCountStatus(1)).toBe('too_few');
    expect(shiftCountStatus(2)).toBe('ok');
    expect(shiftCountStatus(3)).toBe('ok');
    expect(shiftCountStatus(4)).toBe('too_many');
  });
});
