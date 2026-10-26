'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { requireOrgAdmin } from '@/lib/facility-auth'
import {
  BedOptimizerRulesConfig,
  DEFAULT_BED_OPTIMIZER_RULES,
} from '@/lib/bed-allocation-optimizer'

/**
 * Odczyt konfiguracji reguł optymalizatora przydziału łóżek dla placówki (@REQ: ADM-BED-ASSIGNMENT).
 */
export async function getBedOptimizerRulesAction(): Promise<BedOptimizerRulesConfig> {
  try {
    const { orgId } = await requireOrgAdmin()
    const cookieStore = await cookies()
    const raw = cookieStore.get(`sc_bed_rules_${orgId}`)?.value
    if (!raw) return DEFAULT_BED_OPTIMIZER_RULES
    const parsed = JSON.parse(raw)
    return {
      enforceGenderSeparation: parsed.enforceGenderSeparation !== false,
      preferGroundFloorForReducedMobility: parsed.preferGroundFloorForReducedMobility !== false,
    }
  } catch {
    return DEFAULT_BED_OPTIMIZER_RULES
  }
}

/**
 * Zapis konfiguracji reguł optymalizatora przydziału łóżek dla placówki (@REQ: ADM-BED-ASSIGNMENT).
 */
export async function saveBedOptimizerRulesAction(
  rules: BedOptimizerRulesConfig
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { orgId } = await requireOrgAdmin()
    const cookieStore = await cookies()
    cookieStore.set(`sc_bed_rules_${orgId}`, JSON.stringify(rules), {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    })
    revalidatePath('/admin/facility')
    revalidatePath('/admin/settings')
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Błąd zapisu reguł' }
  }
}
