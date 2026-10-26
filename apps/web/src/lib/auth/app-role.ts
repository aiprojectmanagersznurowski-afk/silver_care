import type { User } from '@supabase/supabase-js'
import { ROLES } from '@silvercare/contracts/src/generated/roles'

export type AppRole = (typeof ROLES)[number]['id']

const KNOWN_ROLES = new Set<string>(ROLES.map((r) => r.id))

type WithAppMetadata = Pick<User, 'app_metadata'> | null | undefined

/**
 * Rola użytkownika wyłącznie z app_metadata (ustawia ją tylko serwer) i wyłącznie z kontraktu.
 * user_metadata użytkownik edytuje sam, więc nigdy nie jest źródłem roli. Rola spoza kontraktu → null.
 */
export function getAppRole(user: WithAppMetadata): AppRole | null {
  const role = user?.app_metadata?.role
  return typeof role === 'string' && KNOWN_ROLES.has(role) ? (role as AppRole) : null
}

/** Placówka użytkownika wyłącznie z app_metadata (z tego samego powodu co rola). */
export function getAppOrganizationId(user: WithAppMetadata): string | null {
  const orgId = user?.app_metadata?.organization_id
  return typeof orgId === 'string' && orgId ? orgId : null
}
