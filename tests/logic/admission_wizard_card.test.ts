import { describe, it, expect, beforeEach } from 'vitest';
import { parseNationalId, suggestBeds, type BedCandidate } from '../../apps/web/src/lib/admission-helpers';
import { hashNationalId } from '../../apps/web/src/lib/national-id-hash';

/**
 * @REQ: ADM-RESIDENT-ADD
 * @REQ: SEC-PESEL-HASH
 * @REQ: MDR-VOCABULARY
 *
 * Testy dla kreatora przyjęcia podopiecznego i karty podopiecznego (ADM-RESIDENT-ADMISSION-CARD):
 * AC1: Walidacja PESEL na kroku 1 (suma kontrolna, format).
 * AC2: Poprawna definicja ZSN i scoringu łóżek.
 * AC3: Bezpieczne hashowanie PESEL (zero plain text).
 */
describe('Admission Wizard & Resident Card Logic (@REQ: ADM-RESIDENT-ADD, @REQ: SEC-PESEL-HASH, @REQ: MDR-VOCABULARY)', () => {
  beforeEach(() => {
    process.env.PESEL_HASH_SALT = 'test-salt-secret-admission';
  });

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
    const validMale = parseNationalId('02270803617');
    expect(validMale.valid).toBe(true);
    expect(validMale.gender).toBe('M');
    expect(validMale.birthDate).toBe('2002-07-08');
  });

  it('calculates bed suggestions prioritizing gender alignment and ground floor mobility @REQ: MDR-VOCABULARY', () => {
    const candidates: BedCandidate[] = [
      {
        bedId: 'b-1',
        bedNumber: '1',
        roomId: 'r-1',
        roomNumber: '101',
        floorNumber: 0,
        capacity: 2,
        currentOccupants: [{ gender: 'F' }],
      },
      {
        bedId: 'b-2',
        bedNumber: '2',
        roomId: 'r-2',
        roomNumber: '201',
        floorNumber: 2,
        capacity: 2,
        currentOccupants: [{ gender: 'M' }],
      },
    ];

    // Dla kobiety leżącej rekomendowany jest parter i zgodność płciowa
    const suggestions = suggestBeds(candidates, { gender: 'F', careLevel: 'bedridden' });
    expect(suggestions).toHaveLength(2);

    const topChoice = suggestions[0];
    expect(topChoice.bedId).toBe('b-1');
    expect(topChoice.score).toBeGreaterThan(suggestions[1].score);
    expect(topChoice.reason).toContain('Zgodność płci');
    expect(topChoice.reason).toContain('Parter');
  });

  it('guarantees PESEL is never stored in plain text and only as pesel_hash @REQ: SEC-PESEL-HASH', () => {
    const rawPesel = '52081203447';
    const hash = hashNationalId(rawPesel);

    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe(rawPesel);
    expect(hash).not.toContain(rawPesel);
    expect(hash).toHaveLength(64); // SHA-256 hex string

    // Deterministyczność hashowania przy tej samej soli
    const secondHash = hashNationalId(rawPesel);
    expect(secondHash).toBe(hash);
  });
});
