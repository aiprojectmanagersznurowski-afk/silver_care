import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangePolarCodeForToken, registerPolarUser } from '@/lib/polar-client'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      return NextResponse.redirect(new URL(`/admin/residents?error=polar_${encodeURIComponent(errorParam)}`, req.url))
    }

    if (!code || !state) {
      return NextResponse.json({ error: 'Brak wymaganego kodu lub stanu autoryzacji' }, { status: 400 })
    }

    // Odkoduj stan (residentId, orgId)
    let stateObj: { residentId: string; orgId: string }
    try {
      stateObj = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'))
    } catch {
      return NextResponse.json({ error: 'Nieprawidłowy format stanu autoryzacji' }, { status: 400 })
    }

    if (!stateObj.residentId || !stateObj.orgId) {
      return NextResponse.json({ error: 'Niekompletny stan autoryzacji' }, { status: 400 })
    }

    // 1. Wymień kod na token z użyciem Basic Auth (zgodnie z OAUTH_CONFIG)
    const tokenRes = await exchangePolarCodeForToken(code)

    // 2. Zarejestruj użytkownika w Polar AccessLink API
    await registerPolarUser(tokenRes.accessToken, stateObj.residentId)

    // 3. Połącz z bazą Supabase
    const supabase = await createClient()

    // 4. Utwórz / zaktualizuj powiązanie w external_wearable_links (R06-core-decoupled)
    const { data: link, error: linkErr } = await supabase
      .from('external_wearable_links')
      .upsert({
        organization_id: stateObj.orgId,
        resident_id: stateObj.residentId,
        provider: 'POLAR',
        external_user_id: tokenRes.xUserId
      }, { onConflict: 'resident_id,provider' })
      .select('id')
      .single()

    if (linkErr || !link) {
      return NextResponse.json({ error: 'Błąd zapisu powiązania urządzenia: ' + linkErr?.message }, { status: 500 })
    }

    // 5. Zapisz token w polar_oauth_tokens
    const expiresAt = tokenRes.expiresIn
      ? new Date(Date.now() + tokenRes.expiresIn * 1000).toISOString()
      : null

    const { error: tokenErr } = await supabase
      .from('polar_oauth_tokens')
      .upsert({
        link_id: link.id,
        organization_id: stateObj.orgId,
        access_token: tokenRes.accessToken,
        token_type: tokenRes.tokenType,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'link_id' })

    if (tokenErr) {
      return NextResponse.json({ error: 'Błąd zapisu tokenu urządzenia: ' + tokenErr?.message }, { status: 500 })
    }

    // 6. Zapisz ślad w audit_logs (bez danych osobowych!)
    await supabase.from('audit_logs').insert({
      organization_id: stateObj.orgId,
      resident_id: stateObj.residentId,
      action: 'WEARABLE_LINKED',
      payload: {
        provider: 'POLAR',
        external_user_id: tokenRes.xUserId
      }
    })

    // 7. Przekierowanie powrotne do panelu ze statusem sukcesu
    const redirectUrl = new URL(`/admin/residents/${stateObj.residentId}?polar=connected`, req.url)
    return NextResponse.redirect(redirectUrl)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
