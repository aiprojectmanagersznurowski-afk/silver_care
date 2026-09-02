import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Admin policy in Supabase (family_messages_admin_select) will ensure 
  // only org_admin can read these and only from their organization.
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
    .order('created_at', { ascending: false });

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
