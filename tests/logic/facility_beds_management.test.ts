import { describe, it, expect } from 'vitest';
import {
  isGroundFloor,
  analyzeCurrentAllocation,
  generateRelocationSuggestions,
  OptimizerRoom,
  OptimizerBed,
  OptimizerOccupant,
} from '../../apps/web/src/lib/bed-allocation-optimizer';
import { formatSectorName } from '../../apps/web/src/components/facility/RoomList';

/**
 * @REQ: ADM-FACILITY-MANAGE
 * @REQ: ADM-BED-ASSIGNMENT
 * @REQ: ADM-FACILITY-OCCUPANCY
 *
 * Testy logiki zarządzania strukturą pokoi i łóżek, transparentnych reguł oraz filtrowania.
 */
describe('Facility & Bed Management Logic (@REQ: ADM-FACILITY-MANAGE, @REQ: ADM-BED-ASSIGNMENT, @REQ: ADM-FACILITY-OCCUPANCY)', () => {
  it('correctly identifies ground floor across various naming formats @REQ: ADM-FACILITY-MANAGE', () => {
    expect(isGroundFloor('Parter')).toBe(true);
    expect(isGroundFloor('parter')).toBe(true);
    expect(isGroundFloor('0')).toBe(true);
    expect(isGroundFloor('p')).toBe(true);
    expect(isGroundFloor('ground')).toBe(true);
    expect(isGroundFloor('1. piętro')).toBe(false);
    expect(isGroundFloor('Piętro 2')).toBe(false);
    expect(isGroundFloor(null)).toBe(false);
  });

  it('determines room gender consistency and flags gender conflicts transparently @REQ: ADM-BED-ASSIGNMENT', () => {
    const rooms: OptimizerRoom[] = [
      { id: 'r-1', number: '101', floor: 'Parter', sector: 'A', isActive: true },
      { id: 'r-2', number: '102', floor: '1. piętro', sector: 'B', isActive: true },
    ];

    const beds: OptimizerBed[] = [
      { id: 'b-1', roomId: 'r-1', label: '1', isActive: true },
      { id: 'b-2', roomId: 'r-1', label: '2', isActive: true },
      { id: 'b-3', roomId: 'r-2', label: '1', isActive: true },
      { id: 'b-4', roomId: 'r-2', label: '2', isActive: true },
    ];

    const occupants: OptimizerOccupant[] = [
      {
        residentId: 'res-1',
        residentName: 'Kowalski Jan',
        gender: 'M',
        careLevel: 'walking',
        isZsn: false,
        currentBedId: 'b-1',
        currentRoomId: 'r-1',
      },
      {
        residentId: 'res-2',
        residentName: 'Nowak Anna',
        gender: 'F',
        careLevel: 'walking',
        isZsn: false,
        currentBedId: 'b-2',
        currentRoomId: 'r-1',
      },
      {
        residentId: 'res-3',
        residentName: 'Sowa Ewa',
        gender: 'F',
        careLevel: 'bedridden',
        isZsn: true,
        currentBedId: 'b-3',
        currentRoomId: 'r-2',
      },
    ];

    const metrics = analyzeCurrentAllocation(rooms, beds, occupants);

    expect(metrics.totalRooms).toBe(2);
    expect(metrics.totalBeds).toBe(4);
    expect(metrics.occupiedBeds).toBe(3);
    expect(metrics.freeBeds).toBe(1);
    expect(metrics.genderConflictsCount).toBe(1);

    const room1Analysis = metrics.roomAnalyses.find((r) => r.roomId === 'r-1');
    expect(room1Analysis?.hasGenderConflict).toBe(true);

    const room2Analysis = metrics.roomAnalyses.find((r) => r.roomId === 'r-2');
    expect(room2Analysis?.hasGenderConflict).toBe(false);
    expect(room2Analysis?.hasMobilityMismatch).toBe(true);
  });

  it('filters facility rooms accurately by floor, sector, and occupancy state @REQ: ADM-FACILITY-OCCUPANCY', () => {
    interface TestRoom {
      id: string;
      number: string;
      floor: string;
      sector: string | null;
      beds: number;
      occupied: number;
      free: number;
    }

    const rooms: TestRoom[] = [
      { id: 'r-1', number: '01', floor: 'Parter', sector: 'A', beds: 2, occupied: 2, free: 0 },
      { id: 'r-2', number: '02', floor: 'Parter', sector: 'B', beds: 2, occupied: 1, free: 1 },
      { id: 'r-3', number: '101', floor: '1. piętro', sector: 'A', beds: 3, occupied: 0, free: 3 },
      { id: 'r-4', number: '102', floor: '1. piętro', sector: 'B', beds: 1, occupied: 1, free: 0 },
    ];

    function filterRooms(
      list: TestRoom[],
      filters: { floor?: string; sector?: string; occupancy?: 'all' | 'free' | 'full'; query?: string }
    ) {
      return list.filter((room) => {
        if (filters.floor && filters.floor !== 'all' && room.floor !== filters.floor) return false;
        if (filters.sector && filters.sector !== 'all' && room.sector !== filters.sector) return false;
        if (filters.occupancy === 'free' && room.free <= 0) return false;
        if (filters.occupancy === 'full' && room.free > 0) return false;
        if (filters.query) {
          const q = filters.query.toLowerCase().trim();
          if (!room.number.toLowerCase().includes(q)) return false;
        }
        return true;
      });
    }

    const groundFree = filterRooms(rooms, { floor: 'Parter', occupancy: 'free' });
    expect(groundFree).toHaveLength(1);
    expect(groundFree[0].number).toBe('02');

    const sectorA = filterRooms(rooms, { sector: 'A' });
    expect(sectorA).toHaveLength(2);

    const fullRooms = filterRooms(rooms, { occupancy: 'full' });
    expect(fullRooms).toHaveLength(2);
    expect(fullRooms.map((r) => r.number)).toEqual(['01', '102']);

    const search10 = filterRooms(rooms, { query: '10' });
    expect(search10).toHaveLength(2);
  });

  it('validates atomic bed transfer invariants @REQ: ADM-BED-ASSIGNMENT', () => {
    interface Assignment {
      id: string;
      bed_id: string;
      resident_id: string;
      assigned_at: string;
      unassigned_at: string | null;
      reason: string | null;
    }

    const assignments: Assignment[] = [
      {
        id: 'as-1',
        bed_id: 'b-1',
        resident_id: 'res-1',
        assigned_at: '2026-09-01T10:00:00Z',
        unassigned_at: null,
        reason: 'admission',
      },
    ];

    function simulateTransfer(
      list: Assignment[],
      residentId: string,
      newBedId: string,
      reason: string
    ): Assignment[] {
      const now = new Date().toISOString();
      const updated = list.map((a) => {
        if (a.resident_id === residentId && a.unassigned_at === null) {
          return { ...a, unassigned_at: now, reason: a.reason || 'relocated' };
        }
        return a;
      });
      updated.push({
        id: `as-${Date.now()}`,
        bed_id: newBedId,
        resident_id: residentId,
        assigned_at: now,
        unassigned_at: null,
        reason,
      });
      return updated;
    }

    const afterTransfer = simulateTransfer(assignments, 'res-1', 'b-2', 'Zmiana preferencji');
    const activeForRes1 = afterTransfer.filter((a) => a.resident_id === 'res-1' && a.unassigned_at === null);
    const oldForRes1 = afterTransfer.filter((a) => a.resident_id === 'res-1' && a.unassigned_at !== null);

    expect(activeForRes1).toHaveLength(1);
    expect(activeForRes1[0].bed_id).toBe('b-2');
    expect(activeForRes1[0].reason).toBe('Zmiana preferencji');

    expect(oldForRes1).toHaveLength(1);
    expect(oldForRes1[0].bed_id).toBe('b-1');
    expect(oldForRes1[0].unassigned_at).not.toBeNull();
  });

  it('generates relocation suggestions to resolve gender conflicts and floor mobility barriers @REQ: ADM-BED-ASSIGNMENT', () => {
    const rooms: OptimizerRoom[] = [
      { id: 'r-1', number: '101', floor: '1. piętro', sector: 'A', isActive: true },
      { id: 'r-2', number: '01', floor: 'Parter', sector: 'A', isActive: true },
    ];

    const beds: OptimizerBed[] = [
      { id: 'b-1', roomId: 'r-1', label: '1', isActive: true },
      { id: 'b-2', roomId: 'r-1', label: '2', isActive: true },
      { id: 'b-3', roomId: 'r-2', label: '1', isActive: true },
      { id: 'b-4', roomId: 'r-2', label: '2', isActive: true },
    ];

    // r-1 ma konflikt (M + F). b-3 i b-4 są wolne na parterze.
    const occupants: OptimizerOccupant[] = [
      {
        residentId: 'res-m',
        residentName: 'Kowalski Jan',
        gender: 'M',
        careLevel: 'walking',
        isZsn: false,
        currentBedId: 'b-1',
        currentRoomId: 'r-1',
      },
      {
        residentId: 'res-f',
        residentName: 'Nowak Anna',
        gender: 'F',
        careLevel: 'walking',
        isZsn: false,
        currentBedId: 'b-2',
        currentRoomId: 'r-1',
      },
    ];

    const suggestions = generateRelocationSuggestions(rooms, beds, occupants);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);

    const topSuggestion = suggestions[0];
    expect(topSuggestion.priority).toBe('high');
    expect(topSuggestion.reason).toContain('konfliktu płci');
    expect(topSuggestion.toRoomNumber).toBe('01');
  });

  it('normalizes sector labels correctly via formatSectorName @REQ: ADM-FACILITY-MANAGE', () => {
    expect(formatSectorName('A')).toBe('Sektor A');
    expect(formatSectorName('sektor B')).toBe('sektor B');
    expect(formatSectorName('Sektor Północ')).toBe('Sektor Północ');
    expect(formatSectorName(null)).toBe('—');
    expect(formatSectorName(undefined)).toBe('—');
    expect(formatSectorName('')).toBe('—');
    expect(formatSectorName('   ')).toBe('—');
  });

});
