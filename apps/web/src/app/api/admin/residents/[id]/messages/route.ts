import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = user.app_metadata?.role as string | undefined;
  if (!['org_admin'].includes(role || '')) {
    return NextResponse.json({ error: 'Brak uprawnień do zasobów administracyjnych' }, { status: 403 });
  }

  const { id: resident_id } = await params;

  const orgId = user.app_metadata?.organization_id as string | undefined;
  if (orgId) {
    const { data: resData } = await supabase
      .from('residents')
      .select('organization_id')
      .eq('id', resident_id)
      .single();
    if (!resData || resData.organization_id !== orgId) {
      return NextResponse.json({ error: 'Podopieczny nie należy do Twojej placówki' }, { status: 403 });
    }
  }


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
    .eq('resident_id', resident_id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch resident messages' }, { status: 500 });
  }

  return NextResponse.json({ messages: data }, { status: 200 });
}
