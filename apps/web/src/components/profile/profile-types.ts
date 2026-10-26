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

export { ROLE_LABELS } from '@/lib/auth/role-labels'
