/**
 * Date navigation helpers for Silver Care Family Portal
 */

export function isValidIsoDate(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return false;
  }
  const date = new Date(str + 'T00:00:00Z');
  if (isNaN(date.getTime())) {
    return false;
  }
  return date.toISOString().slice(0, 10) === str;
}

export function getAdjacentDateString(dateStr: string, offsetDays: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}
