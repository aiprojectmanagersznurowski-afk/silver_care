export interface AgendaItem {
  id: string;
  title: string;
  time: string;
  type: string;
  resident_id: string | null;
}

export function mergeAndSortAgenda(common: AgendaItem[], individual: AgendaItem[]): AgendaItem[] {
  const allItems = [...common, ...individual];
  
  // Sort chronologically by time "HH:mm"
  return allItems.sort((a, b) => {
    if (a.time < b.time) return -1;
    if (a.time > b.time) return 1;
    return 0;
  });
}
