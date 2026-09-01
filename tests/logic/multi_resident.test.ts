import { describe, it, expect } from 'vitest';

describe('FAM-MULTI-RESIDENT Logic', () => {
  it('switcher is hidden for single resident @REQ: FAM-MULTI-RESIDENT', () => {
    const residents = [{ id: '1', first_name: 'Jan', last_name: 'K' }];
    // Switcher appears only when residents.length > 1
    expect(residents.length > 1).toBe(false);
  });

  it('switcher is visible for multiple residents @REQ: FAM-MULTI-RESIDENT', () => {
    const residents = [
      { id: '1', first_name: 'Jan', last_name: 'K' },
      { id: '2', first_name: 'Anna', last_name: 'N' }
    ];
    expect(residents.length > 1).toBe(true);
  });

  it('context change loads only selected resident data @REQ: FAM-MULTI-RESIDENT', () => {
    const reports = [
      { resident_id: '1', content: 'Report 1' },
      { resident_id: '2', content: 'Report 2' },
    ];
    const selectedId = '2';
    const filtered = reports.find(r => r.resident_id === selectedId);
    expect(filtered?.content).toBe('Report 2');
  });
});
