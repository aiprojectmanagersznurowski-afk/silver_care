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
  // Kategorie opisują stan opieki, nie jego ocenę (ADR-005, ADR-011): odcienie jednej palety, bez czerwieni.
  walking: 'var(--chart-1)',
  sitting: 'var(--chart-2)',
  bedridden: 'var(--chart-3)',
  hospice: 'var(--chart-5)',
  unknown: 'var(--border)',
}

/** Tailwind bg- classes for care-level badges */
export const CARE_LEVEL_BG_CLASSES: Record<CareLevel | 'unknown', string> = {
  walking: 'bg-chart-1/15 text-foreground',
  sitting: 'bg-chart-2/15 text-foreground',
  bedridden: 'bg-chart-3/20 text-foreground',
  hospice: 'bg-chart-5/15 text-foreground',
  unknown: 'bg-secondary text-secondary-foreground',
}

/** Paleta serii wykresów — tokeny chart-* z kontraktu (ADR-014), rozwiązywane przez przeglądarkę. */
export function getCareLevelChartColors(): Record<CareLevel | 'unknown', string> {
  return CARE_LEVEL_COLORS
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
