import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mergeAndSortAgenda, AgendaItem } from '@/lib/agenda';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Brak identyfikatora podopiecznego' }, { status: 400 });
    }

    // Pobieranie agendy z bazy
    // RLS zadba o to, żeby zwrócone zostały wyłącznie rekordy:
    // a) dozwolone dla danej organizacji
    // b) dla których resident_id IS NULL (wspólne) LUB family ma dostęp do danego resident_id.
    const { data, error } = await supabase
      .from('agenda_items')
      .select('id, title, time, type, resident_id')
      .or(`resident_id.eq.${id},resident_id.is.null`);

    if (error) {
      console.error(`Agenda API error: ${error.message}`);
      return NextResponse.json({ error: 'Błąd podczas pobierania agendy' }, { status: 500 });
    }

    // Podział na wspólne i indywidualne (wymagane przez funkcję mergeAndSortAgenda)
    const common: AgendaItem[] = [];
    const individual: AgendaItem[] = [];

    (data || []).forEach(item => {
      if (item.resident_id === null) {
        common.push(item as AgendaItem);
      } else {
        individual.push(item as AgendaItem);
      }
    });

    const sortedAgenda = mergeAndSortAgenda(common, individual);

    return NextResponse.json({ agenda: sortedAgenda });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 });
  }
}
