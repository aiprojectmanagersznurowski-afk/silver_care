import { describe, it, expect } from 'vitest';
import { buildPrintSections, PRINT_FIELDS } from '../../apps/web/src/lib/shifts/shift-plan-print';
import type { TaskView } from '../../apps/web/src/lib/shifts/shift-tasks-view';

/**
 * @REQ: NUR-SHIFT-PLAN-PRINT
 * Wydruk planu (SC-NUR-16): tylko zadania „Do zrobienia”, pola wyłącznie z kontraktu (bez PESEL i kontaktów),
 * pokoje po numerze, źródło zawsze opisane.
 */
const task = (over: Partial<TaskView>): TaskView => ({
  id: 't', title: 'Zadanie', dueTime: null, source: 'MANUAL', status: 'TODO', carriedFromTaskId: null,
  residentId: null, residentName: null, room: null, bed: null, cancelReason: null, ...over,
});

describe('Wydruk planu pracy (NUR-SHIFT-PLAN-PRINT)', () => {
  it('@REQ: NUR-SHIFT-PLAN-PRINT - układ według pokoi pokazuje tylko zadania do zrobienia, z zadaniami placówki na końcu', () => {
    const sections = buildPrintSections([
      task({ id: 'a', title: 'A', residentId: 'r1', residentName: 'Nowak Anna', room: '10', bed: 'A', dueTime: '12:00:00' }),
      task({ id: 'b', title: 'B', residentId: 'r2', residentName: 'Kowal Jan', room: '2', bed: 'B', source: 'HANDOVER' }),
      task({ id: 'c', title: 'C', status: 'PROPOSED', residentId: 'r2', residentName: 'Kowal Jan', room: '2', bed: 'B' }),
      task({ id: 'd', title: 'D', status: 'DONE' }),
      task({ id: 'e', title: 'E' }),
      task({ id: 'f', title: 'F', status: 'CANCELLED' }),
    ], 'room');
    expect(sections.map((s) => s.heading)).toEqual(['Pokój 2', 'Pokój 10', 'Zadania placówki']);
    expect(sections.map((s) => s.rows.map((row) => row.title))).toEqual([['B'], ['A'], ['E']]);
    expect(sections[0].rows[0]).toEqual({ resident: 'Kowal Jan', place: 'pokój 2, łóżko B', title: 'B', dueTime: '', source: 'Z przekazania', assignee: 'Cała zmiana' });
    expect(sections[1].rows[0].dueTime).toBe('12:00');
  });

  it('@REQ: NUR-SHIFT-PLAN-PRINT - układ według podopiecznych rozdziela osoby w jednym pokoju i odrzuca pozostałe statusy', () => {
    const first = { residentId: 'r1', residentName: 'Nowak Anna', room: '2', bed: 'A' };
    const second = { residentId: 'r2', residentName: 'Kowal Jan', room: '2', bed: 'B' };
    const sections = buildPrintSections([
      task({ ...first, id: 'a', title: 'A' }),
      task({ ...second, id: 'b', title: 'B' }),
      task({ ...first, id: 'c', title: 'C', dueTime: '08:00:00' }),
      task({ ...first, id: 'd', title: 'D', status: 'DONE' }),
      task({ ...second, id: 'e', title: 'E', status: 'PROPOSED' }),
      task({ id: 'f', title: 'F', status: 'CANCELLED' }),
      task({ id: 'g', title: 'G' }),
    ], 'resident');

    expect(sections.map((s) => s.heading)).toEqual([
      'Kowal Jan · pokój 2, łóżko B', 'Nowak Anna · pokój 2, łóżko A', 'Zadania placówki',
    ]);
    expect(sections.map((s) => s.rows.map((row) => row.title))).toEqual([['B'], ['C', 'A'], ['G']]);
  });

  it('@REQ: NUR-SHIFT-PLAN-PRINT - wiersz wydruku zawiera wyłącznie pola dozwolone w kontrakcie', () => {
    const [section] = buildPrintSections([task({ residentId: 'r1', residentName: 'Nowak Anna', room: '1', bed: 'A' })]);
    expect(Object.keys(section.rows[0]).sort()).toEqual(['assignee', 'dueTime', 'place', 'resident', 'source', 'title']);
    expect(PRINT_FIELDS).toEqual(['resident_name', 'room', 'bed', 'task_title', 'due_time', 'source_label', 'assignee']);
  });
});
