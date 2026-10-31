import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = user.app_metadata?.role as string | undefined;
  if (role !== 'org_admin') {
    return NextResponse.json({ error: 'Brak uprawnień kierownika placówki' }, { status: 403 });
  }

  // Odświeżanie w tle dociąga tylko wiadomości nowsze niż `since` (skalowanie skrzynki)
  const since = new URL(request.url).searchParams.get('since');
  if (since !== null && Number.isNaN(Date.parse(since))) {
    return NextResponse.json({ error: 'Nieprawidłowy parametr since' }, { status: 400 });
  }

  // Admin policy in Supabase (family_messages_select) ensures 
  // only org_admin can read these and only from their organization.
  let query = supabase
    .from('family_messages')
    .select(`
      id,
      content,
      created_at,
      resident_id,
      relative_user_id,
      is_from_family,
      staff_user_id,
      residents (
        first_name,
        last_name
      )
    `)
    .order('created_at', { ascending: false });
  if (since !== null) query = query.gt('created_at', since);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }

  // Kto z bliskich pisze: rola z resident_relative_links tylko dla par obecnych w wiadomościach
  const pairs = new Set((data || []).map((m) => `${m.resident_id}:${m.relative_user_id}`));
  const residentIds = [...new Set((data || []).map((m) => m.resident_id))];
  let relatives: Array<{ residentId: string; relativeUserId: string; role: string; isPrimaryContact: boolean }> = [];
  if (residentIds.length > 0) {
    const { data: links } = await supabase
      .from('resident_relative_links')
      .select('resident_id, relative_user_id, role, is_primary_contact')
      .in('resident_id', residentIds);
    relatives = (links || [])
      .filter((l) => pairs.has(`${l.resident_id}:${l.relative_user_id}`))
      .map((l) => ({ residentId: l.resident_id, relativeUserId: l.relative_user_id, role: l.role, isPrimaryContact: Boolean(l.is_primary_contact) }));
  }

  return NextResponse.json({ messages: data, relatives }, { status: 200 });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = user.app_metadata?.role as string | undefined;
  if (role !== 'org_admin') {
    return NextResponse.json({ error: 'Brak uprawnień kierownika placówki' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { resident_id, relative_user_id, content } = body;

    if (!resident_id || !relative_user_id || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get org id to pass RLS
    const { data: resData, error: resError } = await supabase
      .from('residents')
      .select('organization_id')
      .eq('id', resident_id)
      .single();
      
    if (resError || !resData) {
      return NextResponse.json({ error: 'Resident not found' }, { status: 404 });
    }

    const { error: insertError } = await supabase
      .from('family_messages')
      .insert({
        organization_id: resData.organization_id,
        resident_id,
        relative_user_id,
        content,
        is_from_family: false,
        staff_user_id: user.id
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
