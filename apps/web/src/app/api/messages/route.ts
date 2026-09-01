import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { isSpamLimitExceeded } from '../../../../lib/messages';

export async function POST(request: Request) {
  const supabase = createClient();
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

    // Insert message. RLS policy will ensure resident_id is linked to relative_user_id
    // We must pass organization_id. Usually this is obtained from the token or the linked resident.
    // Let's get organization_id from the resident directly since RLS requires it.
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
