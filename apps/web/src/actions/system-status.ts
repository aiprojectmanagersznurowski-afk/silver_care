'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isImpersonationSessionActive, safeGetCookieStore } from '@/lib/impersonation-guards'
import {
  canManageSystemAlerts,
  validateSystemAlertInput,
  buildSystemAlertAuditPayload,
  type SystemAlertInput,
  type SystemAlertRecord,
} from '@/lib/system-status-helpers'

const ALLOWED_STAFF_ROLES = ['super_admin', 'org_admin', 'nurse'] as const

export async function getSystemAlertsAction(): Promise<{ alerts: SystemAlertRecord[]; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { alerts: [], error: 'Użytkownik nieuwierzytelniony' }
    }

    const role = user.app_metadata?.role as string | undefined
    if (!role || !ALLOWED_STAFF_ROLES.includes(role as (typeof ALLOWED_STAFF_ROLES)[number])) {
      return { alerts: [], error: 'Brak uprawnień do odczytu alertów systemowych' }
    }

    // Odczyt z bazy z egzekwowaniem polityki RLS (system_alerts_staff_select)
    const { data, error } = await supabase
      .from('system_alerts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Błąd pobierania alertów systemowych:', error)
      return { alerts: [], error: 'Błąd pobierania alertów systemowych' }
    }

    return { alerts: (data as SystemAlertRecord[]) || [] }
  } catch (err: unknown) {
    console.error('Wyjątek podczas pobierania alertów:', err)
    return { alerts: [], error: 'Błąd pobierania alertów systemowych' }
  }
}

export async function publishSystemAlertAction(input: SystemAlertInput) {
  const validation = validateSystemAlertInput(input)
  if (!validation.valid) {
    return { error: validation.error || 'Nieprawidłowe dane alertu', status: 400 }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Użytkownik nieuwierzytelniony', status: 401 }
  }

  // Autoryzacja wyłącznie z app_metadata (odporność na eskalację z user_metadata)
  const role = user.app_metadata?.role as string | undefined
  const cookieStore = await safeGetCookieStore()
  const isImpersonating = isImpersonationSessionActive(cookieStore, user)

  if (!canManageSystemAlerts(role, isImpersonating)) {
    return {
      error: 'Brak uprawnień. Zarządzanie alertami systemowymi wymaga roli super_admin i braku aktywnej impersonacji.',
      status: 403,
      code: 403,
    }
  }

  // Zapis do tabeli system_alerts z egzekwowaniem RLS super_admin
  const { data: alert, error: insertErr } = await supabase
    .from('system_alerts')
    .insert({
      title: input.title.trim(),
      message: input.message.trim(),
      severity: input.severity,
      status: input.status,
      affected_services: input.affectedServices,
      is_active: true,
      created_by: user.id,
    })
    .select()
    .single()

  if (insertErr || !alert) {
    console.error('Błąd publikacji alertu systemowego:', insertErr)
    return {
      error: 'Nie udało się opublikować alertu systemowego. Spróbuj ponownie później.',
      status: 500,
    }
  }

  // Rejestracja w audit_logs (append-only, zero-PII: bez tytułu i treści komunikatu)
  const auditPayload = buildSystemAlertAuditPayload({
    action: 'SYSTEM_ALERT_PUBLISHED',
    alertId: alert.id,
    severity: input.severity,
    status: input.status,
    affectedServices: input.affectedServices,
  })

  const adminClient = createAdminClient()
  await adminClient.from('audit_logs').insert({
    action: 'SYSTEM_ALERT_PUBLISHED',
    performed_by: user.id,
    payload: auditPayload,
  })

  safeRevalidate(['/admin/system-status', '/admin', '/staff'])

  return { success: true, alertId: alert.id }
}

function safeRevalidate(paths: string[]) {
  try {
    for (const p of paths) {
      revalidatePath(p)
    }
  } catch {
    // Bezpieczne wyciszenie poza kontekstem serwera Next.js (np. w testach)
  }
}

export async function resolveSystemAlertAction(alertId: string) {
  if (!alertId) {
    return { error: 'Brak identyfikatora alertu', status: 400 }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Użytkownik nieuwierzytelniony', status: 401 }
  }

  // Autoryzacja wyłącznie z app_metadata
  const role = user.app_metadata?.role as string | undefined
  const cookieStore = await safeGetCookieStore()
  const isImpersonating = isImpersonationSessionActive(cookieStore, user)

  if (!canManageSystemAlerts(role, isImpersonating)) {
    return {
      error: 'Brak uprawnień. Zamykanie alertów systemowych wymaga roli super_admin i braku aktywnej impersonacji.',
      status: 403,
      code: 403,
    }
  }

  const { data: updated, error: updateErr } = await supabase
    .from('system_alerts')
    .update({
      is_active: false,
      status: 'operational',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', alertId)
    .select()
    .single()

  if (updateErr || !updated) {
    console.error('Błąd zamykania alertu systemowego:', updateErr)
    return {
      error: 'Nie udało się zamknąć alertu. Rekord nie istnieje lub brak uprawnień.',
      status: 500,
    }
  }

  // Ślad audytowy zero-PII
  const auditPayload = buildSystemAlertAuditPayload({
    action: 'SYSTEM_ALERT_RESOLVED',
    alertId: updated.id,
    severity: (updated.severity as SystemAlertRecord['severity']) || 'warning',
    status: 'operational',
    affectedServices: (updated.affected_services as string[]) || [],
  })

  const adminClient = createAdminClient()
  await adminClient.from('audit_logs').insert({
    action: 'SYSTEM_ALERT_RESOLVED',
    performed_by: user.id,
    payload: auditPayload,
  })

  safeRevalidate(['/admin/system-status', '/admin', '/staff'])

  return { success: true }
}
