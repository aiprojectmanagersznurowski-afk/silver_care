import { describe, it, expect } from 'vitest';
import {
  groupTasks,
  normalizeGroupParam,
  sourceLabel,
  statusLabel,
  validateTaskInput,
  type TaskView,
} from '../../apps/web/src/lib/shifts/shift-tasks-view';

/**
 * @REQ: NUR-TASKS
 * Widok zadań zmiany (SC-NUR-13/15): grupowanie per pokój albo per podopieczny, źródło zawsze widoczne,
 * przeniesione zadanie oznaczone, zadanie z przeniesioną kopią nie wisi dwa razy na liście.
 */
const task = (over: Partial<TaskView>): TaskView => ({
  id: 't', title: 'Zadanie', dueTime: null, source: 'MANUAL', status: 'TODO', carriedFromTaskId: null,
  residentId: null, residentName: null, room: null, bed: null, cancelReason: null, ...over,
});

describe('Widok zadań zmiany (NUR-TASKS)', () => {
  it('@REQ: NUR-TASKS - źródło zadania ma czytelną etykietę, a przeniesione jest oznaczone', () => {
    expect(sourceLabel('MANUAL', null)).toBe('Ręczne');
    expect(sourceLabel('HANDOVER', null)).toBe('Z przekazania');
    expect(sourceLabel('CARE_PLAN', null)).toBe('Z planu opieki');
    expect(sourceLabel('HANDOVER', 'abc')).toBe('Przeniesione z poprzedniej zmiany');
    expect(statusLabel('PROPOSED')).toBe('Propozycja');
    expect(statusLabel('TODO')).toBe('Do zrobienia');
    expect(statusLabel('DONE')).toBe('Wykonane');
    expect(statusLabel('CANCELLED')).toBe('Anulowane');
  });

  it('@REQ: NUR-TASKS - grupowanie per pokój: pokoje po numerze, w pokoju po godzinie, zadania placówki osobno na końcu', () => {
    const groups = groupTasks([
      task({ id: 'a', residentId: 'r1', residentName: 'Nowak Anna', room: '10', bed: 'A', dueTime: '12:00' }),
      task({ id: 'b', residentId: 'r2', residentName: 'Kowal Jan', room: '2', bed: 'B', dueTime: '09:00' }),
      task({ id: 'c', residentId: 'r3', residentName: 'Lis Ewa', room: '2', bed: 'A', dueTime: '08:00' }),
      task({ id: 'd' }),
    ], 'room');
    expect(groups.map((g) => g.label)).toEqual(['Pokój 2', 'Pokój 10', 'Zadania placówki']);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['c', 'b']);
  });

  it('@REQ: NUR-TASKS - grupowanie per podopieczny: nazwisko, pokój i łóżko w etykiecie grupy', () => {
    const groups = groupTasks([
      task({ id: 'a', residentId: 'r1', residentName: 'Nowak Anna', room: '10', bed: 'A' }),
      task({ id: 'b', residentId: 'r1', residentName: 'Nowak Anna', room: '10', bed: 'A' }),
      task({ id: 'c', residentId: 'r2', residentName: 'Kowal Jan', room: '2', bed: 'B' }),
    ], 'resident');
    expect(groups.map((g) => g.label)).toEqual(['Kowal Jan · pokój 2, łóżko B', 'Nowak Anna · pokój 10, łóżko A']);
    expect(groups[1].tasks).toHaveLength(2);
  });

  it('@REQ: NUR-TASKS - zadanie, które ma przeniesioną kopię, nie jest pokazywane drugi raz', () => {
    const groups = groupTasks([
      task({ id: 'old' }),
      task({ id: 'new', carriedFromTaskId: 'old' }),
    ], 'room');
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual(['new']);
  });

  it('@REQ: NUR-TASKS - parametr grupowania i dane nowego zadania są walidowane', () => {
    expect(normalizeGroupParam('resident')).toBe('resident');
    expect(normalizeGroupParam('nonsens')).toBe('room');
    expect(normalizeGroupParam(undefined)).toBe('room');
    expect(validateTaskInput({ title: '  ', dueTime: '' })).toBe('Podaj treść zadania.');
    expect(validateTaskInput({ title: 'x'.repeat(301), dueTime: '' })).toBe('Treść zadania może mieć najwyżej 300 znaków.');
    expect(validateTaskInput({ title: 'Podać wodę', dueTime: '25:00' })).toBe('Podaj godzinę w formacie GG:MM.');
    expect(validateTaskInput({ title: 'Podać wodę', dueTime: '' })).toBeNull();
    expect(validateTaskInput({ title: 'Podać wodę', dueTime: '14:30' })).toBeNull();
  });
});
