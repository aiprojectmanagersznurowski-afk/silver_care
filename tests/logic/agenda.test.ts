import { describe, it, expect } from 'vitest';
import { mergeAndSortAgenda } from '../../apps/web/src/lib/agenda';

describe('Agenda Logic (FAM-AGENDA)', () => {
  it('merges common and individual items and sorts them chronologically @REQ: FAM-AGENDA', () => {
    const common = [
      { id: '1', title: 'Obiad', time: '13:00', type: 'MEAL', resident_id: null },
      { id: '2', title: 'Śniadanie', time: '08:00', type: 'MEAL', resident_id: null }
    ];
    
    const individual = [
      { id: '3', title: 'Rehabilitacja', time: '10:00', type: 'PHYSIO', resident_id: 'res-1' },
      { id: '4', title: 'Kolacja', time: '18:00', type: 'MEAL', resident_id: 'res-1' }
    ];

    const result = mergeAndSortAgenda(common, individual);

    expect(result).toHaveLength(4);
    expect(result[0].title).toBe('Śniadanie'); // 08:00
    expect(result[1].title).toBe('Rehabilitacja'); // 10:00
    expect(result[2].title).toBe('Obiad'); // 13:00
    expect(result[3].title).toBe('Kolacja'); // 18:00
  });

  it('returns empty array if no items @REQ: FAM-AGENDA', () => {
    const result = mergeAndSortAgenda([], []);
    expect(result).toHaveLength(0);
  });
});
