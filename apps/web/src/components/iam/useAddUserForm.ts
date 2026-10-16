'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createUserWithRoleAction } from '@/actions/iam'
import { UserItem, AuditLogItem } from './iam-types'
import { CreatedCredentials } from './CreatedCredentialsBanner'

interface UseAddUserFormParams {
  setUsers: React.Dispatch<React.SetStateAction<UserItem[]>>
  setAuditLogs: React.Dispatch<React.SetStateAction<AuditLogItem[]>>
  setStatusMessage: (msg: { type: 'success' | 'error'; text: string } | null) => void
}

export function useAddUserForm({
  setUsers,
  setAuditLogs,
  setStatusMessage
}: UseAddUserFormParams) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('nurse')
  const [password, setPassword] = useState('')
  const [orgId, setOrgId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null)

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Adres e-mail jest wymagany.')
      toast.error('Adres e-mail jest wymagany.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('email', email.trim())
      formData.set('role', role)
      if (password.trim()) formData.set('password', password.trim())
      if (orgId.trim()) formData.set('organizationId', orgId.trim())

      const result = await createUserWithRoleAction(formData)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
      } else if (result?.user) {
        toast.success(`Utworzono konto użytkownika: ${result.user.email}`)
        const u = result.user
        setUsers(prev => [
          {
            id: u.id,
            email: u.email,
            role: u.role,
            organizationId: u.organizationId,
            lastSignInAt: u.lastSignInAt
          },
          ...prev
        ])

        setAuditLogs(prev => [
          {
            id: `local-${Date.now()}`,
            action: 'role_change',
            performed_by: 'super_admin',
            payload: {
              target_user_id: u.id,
              new_role: u.role,
              previous_role: null,
              changed_at: new Date().toISOString()
            },
            created_at: new Date().toISOString()
          },
          ...prev
        ])

        setCreatedCredentials({
          email: u.email,
          role: u.role,
          temporaryPassword: u.temporaryPassword
        })

        setStatusMessage({
          type: 'success',
          text: `Pomyślnie utworzono użytkownika ${u.email} z rolą ${u.role}.`
        })

        setEmail('')
        setPassword('')
        setOrgId('')
        setRole('nurse')
        setIsOpen(false)
      }
    })
  }

  return {
    isOpen,
    setIsOpen,
    email,
    setEmail,
    role,
    setRole,
    password,
    setPassword,
    orgId,
    setOrgId,
    error,
    setError,
    createdCredentials,
    setCreatedCredentials,
    isPending,
    handleCreateUser
  }
}
