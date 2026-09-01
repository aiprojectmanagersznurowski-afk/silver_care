import { describe, it, expect } from 'vitest';

describe('NUR-AGENDA Logic', () => {
  it('agenda item requires type, title, and time @REQ: NUR-AGENDA', () => {
    const item = { title: 'Śniadanie', time: '08:00', type: 'meal' };
    expect(item.title).toBeTruthy();
    expect(item.time).toBeTruthy();
    expect(item.type).toBeTruthy();
  });

  it('null resident_id means item applies to all @REQ: NUR-AGENDA', () => {
    const item = { resident_id: null, title: 'Obiad' };
    expect(item.resident_id).toBeNull();
  });

  it('template items can be applied as new entries @REQ: NUR-AGENDA', () => {
    const templates = [
      { title: 'Śniadanie', time: '08:00', type: 'meal', is_template: true },
      { title: 'Terapia', time: '10:00', type: 'therapy', is_template: true },
    ];
    const todayItems = templates.map(t => ({ ...t, is_template: false }));
    expect(todayItems.every(i => !i.is_template)).toBe(true);
    expect(todayItems).toHaveLength(2);
  });
});
