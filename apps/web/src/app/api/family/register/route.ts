import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateInvitationState, determineConsentsForRole } from '@/lib/onboarding';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password, consentsAccepted } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Brak tokena rejestracji' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Hasło musi mieć co najmniej 8 znaków (wymóg bezpieczeństwa).' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // 1. Pobierz i zweryfikuj zaproszenie
    const { data: invitation, error: inviteError } = await adminClient
      .from('resident_invitations')
      .select('*')
      .eq('id', token)
      .maybeSingle();

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Nieprawidłowy token zaproszenia' }, { status: 400 });
    }

    const validation = validateInvitationState(invitation);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    // 2. Walidacja zgód dla danej roli (CONSENT-GRANTOR)
    const consentEval = determineConsentsForRole(invitation.role, Boolean(consentsAccepted));
    if (!consentEval.allowed) {
      return NextResponse.json({ error: consentEval.error }, { status: 400 });
    }

    // 3. Utwórz użytkownika w Supabase Auth z rolą określoną w zaproszeniu
    const userRole = invitation.role === 'legal_guardian' ? 'legal_guardian' : 'family';
    const emailToRegister = invitation.email?.trim().toLowerCase();

    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email: emailToRegister,
      password: password.trim(),
      email_confirm: true,
      user_metadata: {
        phone: invitation.phone || null,
      },
      app_metadata: {
        role: userRole,
        organization_id: invitation.organization_id,
      },
    });

    if (createError) {
      console.error(`[REGISTER] User creation error:`, createError);
      return NextResponse.json(
        { error: createError.message || 'Wystąpił błąd przy tworzeniu konta (np. konto z tym adresem e-mail już istnieje).' },
        { status: 400 }
      );
    }

    const userId = userData.user.id;

    // 4. Powiązanie w resident_relative_links
    const { error: linkError } = await adminClient
      .from('resident_relative_links')
      .insert({
        resident_id: invitation.resident_id,
        relative_user_id: userId,
        relationship_code: userRole,
        role: userRole,
      });

    if (linkError) {
      console.error(`[REGISTER] Link error:`, linkError);
      return NextResponse.json(
        { error: 'Konto utworzone, ale wystąpił błąd przypisania do podopiecznego.' },
        { status: 500 }
      );
    }

    // 5. Rejestracja zgód Art. 9 RODO w consent_ledger wyłącznie dla legal_guardian (CONSENT-GRANTOR)
    if (consentEval.canGrantArt9 && consentEval.purposes.length > 0) {
      const consentInserts = consentEval.purposes.map((purpose) => ({
        organization_id: invitation.organization_id,
        resident_id: invitation.resident_id,
        purpose,
        granted_by: 'legal_guardian',
      }));

      const { error: consentError } = await adminClient
        .from('consent_ledger')
        .insert(consentInserts);

      if (consentError) {
        console.error(`[REGISTER] Consent ledger error:`, consentError);
      }
    }

    // 6. Zużycie tokena zaproszenia
    const { error: consumeError } = await adminClient
      .from('resident_invitations')
      .update({ claimed_at: new Date().toISOString() })
      .eq('id', token)
      .is('claimed_at', null);

    if (consumeError) {
      console.error(`[REGISTER] Consume error:`, consumeError);
    }

    // 7. Wpis audytowy bez PII (SEC-NO-PII-LOGS)
    await adminClient.from('audit_logs').insert({
      organization_id: invitation.organization_id,
      resident_id: invitation.resident_id,
      action: 'FAMILY_ACCOUNT_ACTIVATED',
      payload: {
        role: userRole,
        user_id: userId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Konto zostało pomyślnie utworzone i aktywowane.',
      role: userRole,
    });
  } catch (error: any) {
    console.error('[REGISTER] Uncaught error:', error);
    return NextResponse.json({ error: 'Wystąpił nieoczekiwany błąd serwera' }, { status: 500 });
  }
}
