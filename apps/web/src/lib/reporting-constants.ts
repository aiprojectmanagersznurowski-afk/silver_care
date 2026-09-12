/**
 * Reporting constants — enums and labels for BI module.
 * Will be migrated to contracts/reporting.contract.mjs when contract window opens.
 */

// ── Care levels ─────────────────────────────────────────────────────────────

export const CARE_LEVELS = ['walking', 'sitting', 'bedridden', 'hospice'] as const
export type CareLevel = typeof CARE_LEVELS[number]

export const CARE_LEVEL_LABELS: Record<CareLevel | 'unknown', string> = {
  walking: '1. Chodzący',
  sitting: '2. Siedzący',
  bedridden: '3. Leżący',
  hospice: '4. Hospicjum',
  unknown: 'Nieokreślony',
}

/**
 * Care-level colors expressed as Tailwind class fragments.
 * For charts that need raw CSS values, use CARE_LEVEL_CHART_COLORS.
 */
export const CARE_LEVEL_COLORS: Record<CareLevel | 'unknown', string> = {
  walking: 'var(--color-primary)',             // sage / green — design token
  sitting: 'var(--color-accent-foreground)',    // accent foreground
  bedridden: 'var(--color-destructive)',        // destructive red
  hospice: 'var(--color-muted-foreground)',     // muted grey
  unknown: 'var(--color-border)',              // border neutral
}

/** Tailwind bg- classes for care-level badges */
export const CARE_LEVEL_BG_CLASSES: Record<CareLevel | 'unknown', string> = {
  walking: 'bg-primary/15 text-primary',
  sitting: 'bg-accent text-accent-foreground',
  bedridden: 'bg-destructive/15 text-destructive',
  hospice: 'bg-muted text-muted-foreground',
  unknown: 'bg-secondary text-secondary-foreground',
}

/**
 * Chart-safe color palette derived from design tokens.
 * Uses computed CSS values resolved at render time.
 */
export function getCareLevelChartColors(): Record<CareLevel | 'unknown', string> {
  if (typeof window === 'undefined') {
    // SSR fallback — these match the :root values from globals.css
    return {
      walking: 'hsl(160, 40%, 31%)',
      sitting: 'hsl(160, 40%, 31%)',
      bedridden: 'hsl(0, 84%, 60%)',
      hospice: 'hsl(24, 6%, 33%)',
      unknown: 'hsl(34, 10%, 71%)',
    }
  }
  const style = getComputedStyle(document.documentElement)
  return {
    walking: style.getPropertyValue('--primary').trim() || 'hsl(160, 40%, 31%)',
    sitting: style.getPropertyValue('--accent-foreground').trim() || 'hsl(160, 40%, 31%)',
    bedridden: style.getPropertyValue('--destructive').trim() || 'hsl(0, 84%, 60%)',
    hospice: style.getPropertyValue('--muted-foreground').trim() || 'hsl(24, 6%, 33%)',
    unknown: style.getPropertyValue('--border').trim() || 'hsl(34, 10%, 71%)',
  }
}

// ── Contract sources ────────────────────────────────────────────────────────

export const CONTRACT_SOURCES = [
  'internet',
  'referral',
  'hospital',
  'mops',
  'family_recommendation',
  'other',
] as const
export type ContractSource = typeof CONTRACT_SOURCES[number]

export const CONTRACT_SOURCE_LABELS: Record<ContractSource, string> = {
  internet: 'Internet',
  referral: 'Polecenie',
  hospital: 'Szpital',
  mops: 'MOPS',
  family_recommendation: 'Polecenie rodziny',
  other: 'Inne',
}

// ── Contract end reasons ────────────────────────────────────────────────────

export const CONTRACT_END_REASONS = [
  'death',
  'family_request',
  'transfer',
  'non_payment',
  'health_improvement',
  'other',
] as const
export type ContractEndReason = typeof CONTRACT_END_REASONS[number]

export const CONTRACT_END_REASON_LABELS: Record<ContractEndReason | 'Nieznany', string> = {
  death: 'Zgon',
  family_request: 'Wypis na życzenie rodziny',
  transfer: 'Przeniesienie do innego ośrodka',
  non_payment: 'Brak płatności',
  health_improvement: 'Poprawa stanu zdrowia',
  other: 'Inne',
  'Nieznany': 'Nieznany',
}

// ── Event types ─────────────────────────────────────────────────────────────

export const EVENT_TYPES = [
  'contract_signed',
  'contract_ended',
  'death',
  'care_level_changed',
  'admission',
  'bed_transfer',
  'package_added',
  'package_removed',
] as const
export type EventType = typeof EVENT_TYPES[number]

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  contract_signed: 'Podpisanie umowy',
  contract_ended: 'Zakończenie umowy',
  death: 'Zgon',
  care_level_changed: 'Zmiana stanu',
  admission: 'Przyjęcie',
  bed_transfer: 'Przeniesienie',
  package_added: 'Dodanie pakietu',
  package_removed: 'Usunięcie pakietu',
}

export const EVENT_TYPE_ICONS: Record<EventType, string> = {
  contract_signed: '📝',
  contract_ended: '📋',
  death: '🕯️',
  care_level_changed: '🔄',
  admission: '🏠',
  bed_transfer: '🛏️',
  package_added: '➕',
  package_removed: '➖',
}

// ── Package types ───────────────────────────────────────────────────────────

export const PACKAGE_TYPES = [
  'zsn',
  'rehabilitation',
  'physiotherapy',
  'speech_therapy',
  'other',
] as const
export type PackageType = typeof PACKAGE_TYPES[number]

export const PACKAGE_TYPE_LABELS: Record<PackageType, string> = {
  zsn: 'ZSN',
  rehabilitation: 'Rehabilitacja',
  physiotherapy: 'Fizjoterapia',
  speech_therapy: 'Logopedia',
  other: 'Inny',
}

// ── Stay ranges ─────────────────────────────────────────────────────────────

export const STAY_RANGE_ORDER = [
  '≤30 dni',
  '31-90 dni',
  '91-180 dni',
  '181-365 dni',
  '1-2 lata',
  '>2 lata',
]

// ── Month labels ────────────────────────────────────────────────────────────

export const MONTH_LABELS_PL = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
]

export const MONTH_LABELS_SHORT_PL = [
  'Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze',
  'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru',
]

// ── Gender ──────────────────────────────────────────────────────────────────

export const GENDER_LABELS: Record<string, string> = {
  M: 'Mężczyzna',
  F: 'Kobieta',
  O: 'Inne',
}
