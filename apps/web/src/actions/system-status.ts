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

export async function getSystemAlertsAction(): Promise<{ alerts: SystemAlertRecord[]; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { alerts: [], error: 'Użytkownik nieuwierzytelniony' }
    }

    const adminClient = createAdminClient()
    const { data, error } = await adminClient
      .from('system_alerts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      // Jeśli tabela nie istnieje jeszcze w zdalnej bazie, fallback do audit_logs
      return getSystemAlertsFromAuditLogs()
    }

    return { alerts: (data as SystemAlertRecord[]) || [] }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Błąd pobierania alertów'
    return { alerts: [], error: message }
  }
}

async function getSystemAlertsFromAuditLogs(): Promise<{ alerts: SystemAlertRecord[] }> {
  try {
    const adminClient = createAdminClient()
    const { data } = await adminClient
      .from('audit_logs')
      .select('id, action, payload, created_at')
      .in('action', ['SYSTEM_ALERT_PUBLISHED', 'SYSTEM_ALERT_RESOLVED'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (!data) return { alerts: [] }

    const alertMap = new Map<string, SystemAlertRecord>()
    for (const entry of data) {
      const p = (entry.payload || {}) as Record<string, unknown>
      const alertId = (p.alert_id as string) || entry.id
      if (!alertMap.has(alertId)) {
        alertMap.set(alertId, {
          id: alertId,
          title: (p.title as string) || 'Komunikat serwisowy',
          message: (p.message as string) || '',
          severity: (p.severity as SystemAlertRecord['severity']) || 'warning',
          status: (p.status as SystemAlertRecord['status']) || (entry.action === 'SYSTEM_ALERT_RESOLVED' ? 'operational' : 'degraded'),
          affected_services: (p.affected_services as string[]) || [],
          is_active: entry.action === 'SYSTEM_ALERT_PUBLISHED',
          created_at: entry.created_at,
          resolved_at: entry.action === 'SYSTEM_ALERT_RESOLVED' ? entry.created_at : null,
        })
      }
    }
    return { alerts: Array.from(alertMap.values()) }
  } catch {
    return { alerts: [] }
  }
}

export async function publishSystemAlertAction(input: SystemAlertInput) {
  const validation = validateSystemAlertInput(input)
  if (!validation.valid) {
    return { error: validation.error || 'Nieprawidłowe dane alertu', status: 400 }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.app_metadata?.role || user?.user_metadata?.role
  const cookieStore = await safeGetCookieStore()
  const isImpersonating = isImpersonationSessionActive(cookieStore, user)

  if (!canManageSystemAlerts(role, isImpersonating)) {
    return {
      error: 'Brak uprawnień. Zarządzanie alertami systemowymi wymaga roli super_admin i braku aktywnej impersonacji.',
      status: 403,
      code: 403,
    }
  }

  const adminClient = createAdminClient()
  const callerUserId = user?.id || null

  let alertRecord: SystemAlertRecord | null = null

  try {
    const { data: alert, error: insertErr } = await adminClient
      .from('system_alerts')
      .insert({
        title: input.title.trim(),
        message: input.message.trim(),
        severity: input.severity,
        status: input.status,
        affected_services: input.affectedServices,
        is_active: true,
        created_by: callerUserId,
      })
      .select()
      .single()

    if (!insertErr && alert) {
      alertRecord = alert as SystemAlertRecord
    }
  } catch {
    // Tabela system_alerts może być jeszcze nieutworzona na bazie zdalnej
  }

  const alertId = alertRecord?.id || crypto.randomUUID()

  // Rejestracja w audit_logs (append-only, zero-PII)
  const auditPayload = {
    ...buildSystemAlertAuditPayload({
      action: 'SYSTEM_ALERT_PUBLISHED',
      alertId,
      severity: input.severity,
      status: input.status,
      affectedServices: input.affectedServices,
    }),
    title: input.title.trim(),
    message: input.message.trim(),
  }

  await adminClient.from('audit_logs').insert({
    action: 'SYSTEM_ALERT_PUBLISHED',
    performed_by: callerUserId,
    payload: auditPayload,
  })

  safeRevalidate(['/admin/system-status', '/admin', '/staff'])

  return { success: true, alertId }
}

function safeRevalidate(paths: string[]) {
  try {
    for (const p of paths) {
      revalidatePath(p)
    }
  } catch {
    // Bezpieczne wyciszenie poza kontekstem serwera Next.js (np. w testach jednostkowych)
  }
}

export async function resolveSystemAlertAction(alertId: string) {
  if (!alertId) {
    return { error: 'Brak identyfikatora alertu', status: 400 }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.app_metadata?.role || user?.user_metadata?.role
  const cookieStore = await safeGetCookieStore()
  const isImpersonating = isImpersonationSessionActive(cookieStore, user)

  if (!canManageSystemAlerts(role, isImpersonating)) {
    return {
      error: 'Brak uprawnień. Zamykanie alertów systemowych wymaga roli super_admin i braku aktywnej impersonacji.',
      status: 403,
      code: 403,
    }
  }

  const adminClient = createAdminClient()
  const callerUserId = user?.id || null

  let updatedSeverity = 'warning'
  let affectedServices: string[] = []

  try {
    const { data: updated } = await adminClient
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

    if (updated) {
      updatedSeverity = updated.severity || updatedSeverity
      affectedServices = updated.affected_services || affectedServices
    }
  } catch {
    // Tabela może jeszcze nie istnieć
  }

  // Ślad audytowy
  const auditPayload = buildSystemAlertAuditPayload({
    action: 'SYSTEM_ALERT_RESOLVED',
    alertId,
    severity: updatedSeverity as SystemAlertRecord['severity'],
    status: 'operational',
    affectedServices,
  })

  await adminClient.from('audit_logs').insert({
    action: 'SYSTEM_ALERT_RESOLVED',
    performed_by: callerUserId,
    payload: auditPayload,
  })

  safeRevalidate(['/admin/system-status', '/admin', '/staff'])

  return { success: true }
}
