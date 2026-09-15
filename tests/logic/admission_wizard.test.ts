import { describe, it, expect } from 'vitest';
import { parseNationalId, suggestBeds, BedCandidate } from '../../apps/web/src/lib/admission-helpers';

describe('Admission Wizard Logic (ADM-RESIDENT-WIZARD)', () => {
  it('correctly calculates birth date and gender from compliant PESEL @REQ: ADM-RESIDENT-ADD', () => {
    const resMale = parseNationalId('48021501238');
    expect(resMale.valid).toBe(true);
    expect(resMale.birthDate).toBe('1948-02-15');
    expect(resMale.gender).toBe('M');
    expect(resMale.genderLabel).toBe('Mężczyzna');

    const resFemale = parseNationalId('52081203447');
    expect(resFemale.valid).toBe(true);
    expect(resFemale.birthDate).toBe('1952-08-12');
    expect(resFemale.gender).toBe('F');
    expect(resFemale.genderLabel).toBe('Kobieta');
  });

  it('rejects invalid checksum PESEL @REQ: ADM-RESIDENT-ADD', () => {
    const invalid = parseNationalId('52081203449');
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toMatch(/suma kontrolna/i);
  });

  it('suggests matching beds based on gender harmony and ground floor mobility @REQ: ADM-BED-ASSIGNMENT', () => {
    const candidates: BedCandidate[] = [
      {
        bedId: 'bed-1',
        bedNumber: '1A',
        roomId: 'room-1',
        roomNumber: '101',
        floorNumber: 0,
        capacity: 2,
        currentOccupants: [{ gender: 'F' }]
      },
      {
        bedId: 'bed-2',
        bedNumber: '2A',
        roomId: 'room-2',
        roomNumber: '201',
        floorNumber: 2,
        capacity: 2,
        currentOccupants: [{ gender: 'M' }]
      },
      {
        bedId: 'bed-3',
        bedNumber: '3A',
        roomId: 'room-3',
        roomNumber: '001',
        floorNumber: 0,
        capacity: 1,
        currentOccupants: []
      }
    ];

    const suggestions = suggestBeds(candidates, { gender: 'F', careLevel: 'bedridden' });
    
    expect(suggestions[0].bedId).toBe('bed-1');
    expect(suggestions[0].reason).toContain('Zgodność płci');
    expect(suggestions[0].reason).toContain('Parter');

    const worst = suggestions.find(s => s.bedId === 'bed-2');
    expect(worst?.score).toBeLessThan(50);
    expect(worst?.reason).toContain('odmiennej płci');
  });
});
