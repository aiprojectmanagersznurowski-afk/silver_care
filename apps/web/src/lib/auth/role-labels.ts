import { ROLES } from '@silvercare/contracts/src/generated/roles'

/** Nazwy ról z kontraktu (ROLES.label, SUP-IAM-PANEL). Aplikacja nie wpisuje nazw ról sama. */
export const ROLE_LABELS: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.id, r.label]))

/** Nazwa roli do pokazania; rola spoza kontraktu nie ujawnia identyfikatora technicznego. */
export function roleLabel(role: string | null | undefined): string {
  return (role && ROLE_LABELS[role]) || 'Brak roli'
}
