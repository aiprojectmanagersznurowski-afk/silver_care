import { ROLES } from '@silvercare/contracts/src/generated/roles'

export interface UserItem {
  id: string
  email: string
  role: string
  organizationId?: string | null
  lastSignInAt?: string | null
  isActive?: boolean
}

export interface AuditLogItem {
  id: string
  action: string
  performed_by?: string | null
  payload: {
    target_user_id?: string
    new_role?: string
    previous_role?: string | null
    changed_at?: string
  }
  created_at: string
}

export interface IamManagementClientProps {
  initialUsers: UserItem[]
  initialAuditLogs: AuditLogItem[]
  currentUserId?: string
  forcedState?: 'loading' | 'empty' | 'success' | 'error'
  errorMessage?: string
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin (Globalny)',
  org_admin: 'Administrator Placówki (Org Admin)',
  nurse: 'Personel Opiekuńczy (Nurse)',
  legal_guardian: 'Opiekun Prawny (Legal Guardian)',
  family: 'Członek Rodziny (Family)',
}

// AC2: Blokada wyboru roli super_admin w UI
export const AVAILABLE_ROLES = ROLES
  .filter(r => r.id !== 'super_admin')
  .map(r => ({
    id: r.id,
    label: ROLE_LABELS[r.id] || r.id,
  }))
