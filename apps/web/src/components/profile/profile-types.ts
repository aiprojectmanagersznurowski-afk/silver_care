export interface ProfileData {
  user: {
    id: string
    email?: string
    role: string
    organizationId?: string | null
    lastSignInAt?: string
  }
  logs: Array<{
    id: string
    action: string
    created_at: string | null
    payload: unknown
  }>
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Administrator',
  org_admin: 'Administrator Placówki',
  nurse: 'Pielęgniarka / Personel Medyczny',
  family: 'Bliski / Rodzina',
  legal_guardian: 'Opiekun Prawny',
}
