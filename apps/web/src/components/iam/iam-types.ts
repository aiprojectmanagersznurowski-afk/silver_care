import { ROLES } from '@silvercare/contracts/src/generated/roles'
import { ROLE_LABELS } from '@/lib/auth/role-labels'

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

export { ROLE_LABELS }

// AC2: Blokada wyboru roli super_admin w UI
export const AVAILABLE_ROLES = ROLES
  .filter(r => r.id !== 'super_admin')
  .map(r => ({
    id: r.id,
    label: ROLE_LABELS[r.id],
  }))
