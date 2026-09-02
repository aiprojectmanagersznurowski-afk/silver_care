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
      relative_user_id
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }

  return NextResponse.json({ messages: data }, { status: 200 });
}
