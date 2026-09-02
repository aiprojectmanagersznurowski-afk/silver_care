import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { maskPhysiologicalData } from '@/lib/dashboard';

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

    // Pobieranie najnowszego raportu
    // RLS zadba o to, żeby rodzina widziała tylko status='PUBLISHED'
    const { data, error } = await supabase
      .from('daily_reports')
      .select('id, content, status, created_at')
      .eq('resident_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`DailyReport API error: ${error.message}`);
      return NextResponse.json({ error: 'Błąd podczas pobierania raportu' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ report: null }); // stan 'empty'
    }

    // Usunięcie pól fizjologicznych przed zwróceniem na frontend
    const cleanedContent = maskPhysiologicalData(data.content);

    return NextResponse.json({ 
      report: {
        id: data.id,
        status: data.status,
        created_at: data.created_at,
        content: cleanedContent
      }
    });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 });
  }
}
