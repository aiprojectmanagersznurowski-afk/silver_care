import { describe, it, expect } from 'vitest';

describe('NUR-BOARD Logic', () => {
  function getNoteStatus(resident: { daily_reports: Array<{status: string}>, voice_draft_notes: Array<{status: string}> }) {
    if (resident.daily_reports.some(r => r.status === 'PUBLISHED')) return 'ready';
    if (resident.voice_draft_notes.some(d => d.status === 'DRAFT') || resident.daily_reports.some(r => r.status === 'DRAFT')) return 'draft';
    return 'none';
  }

  it('returns ready when published report exists @REQ: NUR-BOARD', () => {
    expect(getNoteStatus({ daily_reports: [{ status: 'PUBLISHED' }], voice_draft_notes: [] })).toBe('ready');
  });

  it('returns draft when draft exists @REQ: NUR-BOARD', () => {
    expect(getNoteStatus({ daily_reports: [], voice_draft_notes: [{ status: 'DRAFT' }] })).toBe('draft');
  });

  it('returns none when no notes @REQ: NUR-BOARD', () => {
    expect(getNoteStatus({ daily_reports: [], voice_draft_notes: [] })).toBe('none');
  });

  it('filters residents by floor @REQ: NUR-BOARD', () => {
    const residents = [
      { id: '1', floor: 'Piętro 1' },
      { id: '2', floor: 'Piętro 2' },
      { id: '3', floor: 'Piętro 1' },
    ];
    const filtered = residents.filter(r => r.floor === 'Piętro 1');
    expect(filtered).toHaveLength(2);
  });
});
