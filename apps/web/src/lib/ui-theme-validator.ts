/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 * @REQ: MDR-NO-INTERPRETATION
 * @REQ: MDR-NO-PHYSIO-TO-FAMILY
 *
 * Deterministyczny walidator i helpery reguł motywu, dostępności oraz routingu UI.
 */

import { TYPOGRAPHY, ACCESSIBILITY, COLORS, LAYOUT_PRINCIPLES } from '@silvercare/contracts/src/generated/design'

/**
 * Walidacja neutralności kolorów poziomów opieki (ADR-005, MDR-NO-INTERPRETATION).
 * Poziomy opieki nie mogą używać czerwieni ani oceniania stanu podopiecznego.
 */
export function validateCareLevelNeutrality(
  careLevelColors: Record<string, string>,
  careLevelBgClasses?: Record<string, string>
): { valid: boolean; violations: string[] } {
  const violations: string[] = []
  const bannedPatterns = [/destructive/i, /red-\d+/i, /rose-\d+/i, /emerald-\d+/i, /green-\d+/i]

  for (const [level, color] of Object.entries(careLevelColors)) {
    for (const pattern of bannedPatterns) {
      if (pattern.test(color)) {
        violations.push(`Poziom ${level} używa zakazanego koloru oceny: ${color}`)
      }
    }
  }

  if (careLevelBgClasses) {
    for (const [level, bg] of Object.entries(careLevelBgClasses)) {
      for (const pattern of bannedPatterns) {
        if (pattern.test(bg)) {
          violations.push(`Poziom ${level} używa zakazanej klasy tła: ${bg}`)
        }
      }
    }
  }

  return { valid: violations.length === 0, violations }
}

/**
 * Walidacja skali typograficznej kontraktu (zakaz mikro-fontów <12px, ADR-020).
 */
export function validateTypographyScale(typography: typeof TYPOGRAPHY): { valid: boolean; violations: string[] } {
  const violations: string[] = []

  // ADR-020: skala szablonu shadcn-admin — 14px bazowo, minimum 12px
  if (typography.baseSize !== '14px') {
    violations.push(`Rozmiar bazowy to ${typography.baseSize}, oczekiwano 14px`)
  }

  for (const item of typography.scale) {
    const px = parseInt(item.size, 10)
    if (px < 12) {
      violations.push(`Element typografii ${item.id} ma ${item.size} (< 12px)`)
    }
  }

  return { valid: violations.length === 0, violations }
}

/**
 * Walidacja celów dotykowych i kontrastu (UI-ACCESSIBILITY).
 */
export function validateAccessibilityStandards(accessibility: typeof ACCESSIBILITY): { valid: boolean; violations: string[] } {
  const violations: string[] = []
  const touchTarget = parseInt(accessibility.touchTargetMinimum, 10)

  // ADR-018: próg 38px — kompromis między ADR-016 (44px) a skalą szablonu (32px)
  if (touchTarget < 38) {
    violations.push(`Minimalny cel dotykowy ${accessibility.touchTargetMinimum} < 38px`)
  }

  if (accessibility.contrastMinimum < 4.5) {
    violations.push(`Minimalny kontrast ${accessibility.contrastMinimum} < 4.5:1`)
  }

  return { valid: violations.length === 0, violations }
}

/**
 * Walidacja obecności wymaganych tokenów kolorów w motywie.
 */
export function validateThemeTokens(themeColors: Record<string, { value: string }>): { valid: boolean; missing: string[] } {
  const requiredTokens = [
    'bg', 'surface', 'surface-sunken', 'border', 'text', 'text-secondary',
    'accent', 'destructive', 'sidebar', 'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'
  ]
  const missing = requiredTokens.filter((token) => !themeColors[token] || !themeColors[token].value)
  return { valid: missing.length === 0, missing }
}

/**
 * Rozstrzyga ścieżkę powrotu z profilu w zależności od roli (UI-PROFILE-DEADEND-FIX).
 */
export function resolveProfileBackHref(role?: string): string {
  if (role === 'super_admin' || role === 'org_admin') {
    return '/admin'
  }
  if (role === 'nurse') {
    return '/staff'
  }
  return '/dashboard'
}

/**
 * Rozstrzyga docelową stronę logowania wg roli (SEC-SESSION, RBAC).
 */
export function resolveRoleDestination(role?: string): string {
  if (role === 'super_admin' || role === 'org_admin') {
    return '/admin'
  }
  if (role === 'nurse') {
    return '/staff'
  }
  if (role === 'family' || role === 'legal_guardian') {
    return '/dashboard'
  }
  return '/login?error=unauthorized'
}

/**
 * Prosta walidacja formularza logowania (UI-ACCESSIBILITY).
 */
export function validateLoginCredentials(email: string, password: string): { valid: boolean; error?: string } {
  if (!email || !email.trim() || !email.includes('@')) {
    return { valid: false, error: 'Podaj poprawny adres e-mail' }
  }
  if (!password || password.trim().length === 0) {
    return { valid: false, error: 'Wprowadź hasło' }
  }
  return { valid: true }
}
