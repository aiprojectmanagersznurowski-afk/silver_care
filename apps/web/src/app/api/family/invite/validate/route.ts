import { NextResponse, NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateInvitationState } from '@/lib/onboarding';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        validateInvitationState(null),
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const { data: invitation, error } = await adminClient
      .from('resident_invitations')
      .select('*')
      .eq('id', token)
      .maybeSingle();

    if (error || !invitation) {
      return NextResponse.json(
        validateInvitationState(null),
        { status: 404 }
      );
    }

    const validation = validateInvitationState(invitation);
    if (!validation.valid) {
      return NextResponse.json(validation, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      ...validation,
    });
  } catch (error: any) {
    console.error('[INVITE_VALIDATE] Error:', error);
    return NextResponse.json(
      {
        valid: false,
        status: 'ERROR',
        message: 'Wystąpił nieoczekiwany błąd podczas weryfikacji zaproszenia.',
      },
      { status: 500 }
    );
  }
}
