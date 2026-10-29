import { describe, it, expect } from 'vitest';
import { CAPACITY_POLICY } from '../../packages/contracts/src/generated/facility';
import { evaluateCapacity, buildCapacityExceededAudit, capacityWarningMessage, isPresentResident, countPresentResidents } from '../../apps/web/src/lib/capacity-limit';

/**
 * @REQ: ADM-CAPACITY-LIMIT
 *
 * Jedna ocena limitu miejsc dla trzech punktów kontroli z kontraktu (CAPACITY_POLICY.checkpoints):
 * dodanie łóżek liczy łóżka, przyjęcie i import liczą aktywnych podopiecznych.
 */
describe('Ocena limitu miejsc (ADM-CAPACITY-LIMIT)', () => {
  it('@REQ: ADM-CAPACITY-LIMIT - obsługuje dokładnie punkty kontroli z kontraktu', () => {
    for (const cp of CAPACITY_POLICY.checkpoints) {
      const r = evaluateCapacity({ operation: cp.id, residentLimit: 10, currentBeds: 10, currentResidents: 10, added: 1 });
      expect(r.exceeds, cp.id).toBe(true);
      expect(r.counts, cp.id).toBe(cp.counts);
    }
    expect(() => evaluateCapacity({ operation: 'nieznana' as never, residentLimit: 10, currentBeds: 0, currentResidents: 0, added: 1 })).toThrow();
  });

  it('@REQ: ADM-CAPACITY-LIMIT - dodanie łóżek liczy łóżka, nie podopiecznych', () => {
    const r = evaluateCapacity({ operation: 'bed_create', residentLimit: 50, currentBeds: 49, currentResidents: 10, added: 4 });
    expect(r).toMatchObject({ exceeds: true, counts: 'beds', projected: 53, limit: 50, excess: 3 });
    expect(evaluateCapacity({ operation: 'bed_create', residentLimit: 50, currentBeds: 46, currentResidents: 60, added: 4 }).exceeds).toBe(false);
  });

  it('@REQ: ADM-CAPACITY-LIMIT - przyjęcie i import liczą aktywnych podopiecznych; równo z limitem to nie przekroczenie', () => {
    expect(evaluateCapacity({ operation: 'resident_admit', residentLimit: 50, currentBeds: 80, currentResidents: 49, added: 1 }).exceeds).toBe(false);
    expect(evaluateCapacity({ operation: 'resident_admit', residentLimit: 50, currentBeds: 80, currentResidents: 50, added: 1 })).toMatchObject({ exceeds: true, projected: 51, excess: 1 });
    expect(evaluateCapacity({ operation: 'resident_bulk_import', residentLimit: 50, currentBeds: 0, currentResidents: 45, added: 10 })).toMatchObject({ exceeds: true, counts: 'residents', projected: 55, excess: 5 });
  });

  it('@REQ: ADM-CAPACITY-LIMIT - wpis audytu z kontraktu, bez danych osobowych', () => {
    const r = evaluateCapacity({ operation: 'resident_admit', residentLimit: 50, currentBeds: 50, currentResidents: 50, added: 1 });
    const audit = buildCapacityExceededAudit(r);
    expect(audit.action).toBe(CAPACITY_POLICY.onExceed.auditAction);
    expect(audit.payload).toEqual({ operation: 'resident_admit', counts: 'residents', resident_limit: 50, projected_count: 51, excess: 1 });
    expect(Object.keys(audit.payload)).not.toEqual(expect.arrayContaining(['first_name']));
    expect(JSON.stringify(audit.payload)).not.toMatch(/first_name|last_name|pesel|resident_id|imię|nazwisk/i);
  });

  it('@REQ: ADM-CAPACITY-LIMIT - miejsce zajmuje tylko podopieczny faktycznie przebywający w placówce (decyzja Michała 2026-10-29)', () => {
    const today = new Date('2026-10-29T10:00:00Z');
    const base = { archived_at: null, death_date: null, contract_end_date: null };
    expect(isPresentResident(base, today)).toBe(true);
    expect(isPresentResident({ ...base, contract_end_date: '2026-11-30' }, today)).toBe(true);
    expect(isPresentResident({ ...base, archived_at: '2026-10-01T00:00:00Z' }, today)).toBe(false);
    expect(isPresentResident({ ...base, death_date: '2026-10-20' }, today)).toBe(false);
    expect(isPresentResident({ ...base, contract_end_date: '2026-10-29' }, today)).toBe(false);
    expect(isPresentResident({ ...base, contract_end_date: '2026-10-01' }, today)).toBe(false);
    expect(countPresentResidents([base, { ...base, death_date: '2026-10-20' }, { ...base, contract_end_date: '2026-12-01' }], today)).toBe(2);
  });

  it('@REQ: ADM-CAPACITY-LIMIT - komunikat ostrzeżenia z liczbami i terminologią słownika', () => {
    const beds = capacityWarningMessage(evaluateCapacity({ operation: 'bed_create', residentLimit: 50, currentBeds: 49, currentResidents: 0, added: 4 }));
    expect(beds).toBe('Placówka będzie miała 53 łóżka przy limicie miejsc 50 (o 3 więcej).');
    const residents = capacityWarningMessage(evaluateCapacity({ operation: 'resident_admit', residentLimit: 50, currentBeds: 0, currentResidents: 50, added: 1 }));
    expect(residents).toBe('Placówka będzie miała 51 podopiecznych przy limicie miejsc 50 (o 1 więcej).');
    expect(beds + residents).not.toMatch(/pensjonariusz|ośrod|pojemno/i);
  });
});
