import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSpamLimitExceeded } from '@/lib/messages';
import { getFamilyResidents } from '@/lib/family-residents';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch messages where this family member is involved
  const { data, error } = await supabase
    .from('family_messages')
    .select(`
      id,
      content,
      created_at,
      resident_id,
      relative_user_id,
      is_from_family,
      staff_user_id
    `)
    .eq('relative_user_id', user.id)
    .order('created_at', { ascending: true }); // Chronologicznie do czatu

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }

  return NextResponse.json({ messages: data }, { status: 200 });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { resident_id, content } = body;

    if (!resident_id || !content) {
      return NextResponse.json({ error: 'Missing resident_id or content' }, { status: 400 });
    }

    // Check rate limit: count messages from this user in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from('family_messages')
      .select('id', { count: 'exact', head: true })
      .eq('relative_user_id', user.id)
      .gte('created_at', oneHourAgo);

    if (countError) {
      return NextResponse.json({ error: 'Failed to check limit' }, { status: 500 });
    }

    if (isSpamLimitExceeded(count || 0)) {
      return NextResponse.json(
        { error: 'Limit wiadomości przekroczony. Ze względu na szanowanie czasu personelu, możesz wysłać maksymalnie 3 wiadomości na godzinę.' },
        { status: 429 }
      );
    }

    // SC-FAM-08: bez odczytu tabeli residents. Podopieczny musi być na liście bliskiego
    // (get_family_resident_overview filtruje po placówce z JWT), więc placówka pochodzi z JWT.
    const organizationId = user.app_metadata?.organization_id as string | undefined;
    const overview = await getFamilyResidents(supabase);
    if (overview.status === 'error') {
      return NextResponse.json({ error: 'Failed to load residents' }, { status: 500 });
    }
    if (!organizationId || !overview.residents.some((r) => r.id === resident_id)) {
      return NextResponse.json({ error: 'Resident not found' }, { status: 404 });
    }

    const { error: insertError } = await supabase
      .from('family_messages')
      .insert({
        organization_id: organizationId,
        resident_id,
        relative_user_id: user.id,
        content
      });

    if (insertError) {
      console.error(insertError);
      return NextResponse.json({ error: 'Failed to send message (RLS or DB error)' }, { status: 403 });
    }

    return NextResponse.json({ success: true }, { status: 201 });

  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
