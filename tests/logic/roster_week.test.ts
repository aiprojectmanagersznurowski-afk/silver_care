import { describe, it, expect } from 'vitest';
import { weekStartOf, weekDays, shiftWeek, normalizeWeekParam, todayWarsaw, formatDayLabel, formatWeekLabel } from '../../apps/web/src/lib/shifts/roster-week';

/**
 * @REQ: NUR-SHIFT-CONFIG
 *
 * Grafik układany tygodniami (poniedziałek–niedziela) w strefie Europe/Warsaw. Daty to teksty RRRR-MM-DD liczone
 * arytmetyką UTC, więc zmiana czasu (koniec lata 2026-10-25) nie dubluje ani nie gubi dni.
 */
describe('Tydzień grafiku (NUR-SHIFT-CONFIG)', () => {
  it('@REQ: NUR-SHIFT-CONFIG - początek tygodnia to poniedziałek, także dla niedzieli', () => {
    expect(weekStartOf('2026-11-02')).toBe('2026-11-02');
    expect(weekStartOf('2026-11-04')).toBe('2026-11-02');
    expect(weekStartOf('2026-11-08')).toBe('2026-11-02');
    expect(weekStartOf('2026-11-09')).toBe('2026-11-09');
  });

  it('@REQ: NUR-SHIFT-CONFIG - tydzień ma 7 dni, także przez zmianę czasu', () => {
    expect(weekDays('2026-11-02')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    const dst = weekDays('2026-10-19');
    expect(dst).toHaveLength(7);
    expect(new Set(dst).size).toBe(7);
    expect(dst[6]).toBe('2026-10-25');
  });

  it('@REQ: NUR-SHIFT-CONFIG - przesunięcie o tydzień w obie strony', () => {
    expect(shiftWeek('2026-11-02', 1)).toBe('2026-11-09');
    expect(shiftWeek('2026-11-02', -1)).toBe('2026-10-26');
    expect(shiftWeek('2026-12-28', 1)).toBe('2027-01-04');
  });

  it('@REQ: NUR-SHIFT-CONFIG - parametr tygodnia: poprawny, błędny albo brak wracają do tygodnia bieżącego', () => {
    const now = new Date('2026-11-04T10:00:00Z');
    expect(normalizeWeekParam('2026-11-10', now)).toBe('2026-11-09');
    expect(normalizeWeekParam(undefined, now)).toBe('2026-11-02');
    expect(normalizeWeekParam('nie-data', now)).toBe('2026-11-02');
    expect(normalizeWeekParam('2026-13-45', now)).toBe('2026-11-02');
  });

  it('@REQ: NUR-SHIFT-CONFIG - „dziś” liczone w Europe/Warsaw, nie w UTC', () => {
    expect(todayWarsaw(new Date('2026-11-01T23:30:00Z'))).toBe('2026-11-02');
    expect(todayWarsaw(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02');
  });

  it('@REQ: NUR-SHIFT-CONFIG - etykiety dnia i tygodnia po polsku', () => {
    expect(formatDayLabel('2026-11-02')).toBe('poniedziałek 2.11');
    expect(formatDayLabel('2026-11-08')).toBe('niedziela 8.11');
    expect(formatWeekLabel('2026-11-02')).toBe('2.11–8.11.2026');
    expect(formatWeekLabel('2026-12-28')).toBe('28.12.2026–3.01.2027');
  });
});
