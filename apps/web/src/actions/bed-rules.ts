'use server'

import { revalidatePath } from 'next/cache'
import { requireOrgAdmin } from '@/lib/facility-auth'
import {
  BedOptimizerRulesConfig,
  DEFAULT_BED_OPTIMIZER_RULES,
} from '@/lib/bed-allocation-optimizer'

/**
 * Odczyt konfiguracji reguł optymalizatora przydziału łóżek dla placówki z bazy danych (@REQ: ADM-BED-ASSIGNMENT).
 */
export async function getBedOptimizerRulesAction(): Promise<BedOptimizerRulesConfig> {
  try {
    const { orgId, supabase } = await requireOrgAdmin({ allowImpersonation: true })
    const { data, error } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single()

    if (error || !data) return DEFAULT_BED_OPTIMIZER_RULES

    const settings = (data.settings as Record<string, unknown> | null) || {}
    const bedRules = (settings.bed_allocation_rules as Record<string, unknown> | null) || {}

    return {
      enforceGenderSeparation: bedRules.enforceGenderSeparation !== false,
      preferGroundFloorForReducedMobility: bedRules.preferGroundFloorForReducedMobility !== false,
    }
  } catch {
    return DEFAULT_BED_OPTIMIZER_RULES
  }
}

/**
 * Zapis konfiguracji reguł optymalizatora przydziału łóżek dla placówki do bazy danych (@REQ: ADM-BED-ASSIGNMENT).
 * Każda zmiana jest trwale odnotowywana w rejestrze audytu (audit_logs).
 */
export async function saveBedOptimizerRulesAction(
  rules: BedOptimizerRulesConfig
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { orgId, user, supabase, adminClient } = await requireOrgAdmin()

    // 1. Pobierz obecne ustawienia, by nie nadpisać innych kluczy
    const { data: existing } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single()

    const currentSettings = (existing?.settings as Record<string, unknown> | null) || {}
    const updatedSettings = {
      ...currentSettings,
      bed_allocation_rules: {
        enforceGenderSeparation: rules.enforceGenderSeparation !== false,
        preferGroundFloorForReducedMobility: rules.preferGroundFloorForReducedMobility !== false,
      },
    }

    // 2. Aktualizacja kolumny settings w tabeli organizations
    const { error: updateErr } = await supabase
      .from('organizations')
      .update({ settings: updatedSettings })
      .eq('id', orgId)

    if (updateErr) {
      return { error: `Błąd zapisu ustawień: ${updateErr.message}` }
    }

    // 3. Wpis do rejestru audytu
    await adminClient.from('audit_logs').insert({
      organization_id: orgId,
      performed_by: user.id,
      action: 'ORGANIZATION_SETTINGS_UPDATED',
      payload: {
        setting_key: 'bed_allocation_rules',
        new_values: {
          enforceGenderSeparation: rules.enforceGenderSeparation !== false,
          preferGroundFloorForReducedMobility: rules.preferGroundFloorForReducedMobility !== false,
        },
      },
    })

    revalidatePath('/admin/facility')
    revalidatePath('/admin/settings')
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Błąd zapisu reguł' }
  }
}
