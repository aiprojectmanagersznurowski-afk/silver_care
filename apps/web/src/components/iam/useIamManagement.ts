'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  updateUserRoleAction,
  resetUserPasswordAction,
  manageUserStatusAction
} from '@/actions/iam'
import { UserItem, AuditLogItem, AVAILABLE_ROLES } from './iam-types'
import { useAddUserForm } from './useAddUserForm'

export function useIamManagement(
  initialUsers: UserItem[],
  initialAuditLogs: AuditLogItem[]
) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers)
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(initialAuditLogs)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  // Stan dialogu zmiany roli
  const [changeRoleUser, setChangeRoleUser] = useState<UserItem | null>(null)
  const [changeRoleSelectedRole, setChangeRoleSelectedRole] = useState<string>('')
  const [changeRoleError, setChangeRoleError] = useState<string | null>(null)

  // Stan dialogu dodawania użytkownika (wydzielony hook)
  const addUser = useAddUserForm({ setUsers, setAuditLogs, setStatusMessage })

  // Stan dialogu resetowania hasła
  const [resetPasswordUser, setResetPasswordUser] = useState<UserItem | null>(null)
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null)

  // Stan dialogu blokady / trwałego usuwania konta
  const [deleteUserTarget, setDeleteUserTarget] = useState<UserItem | null>(null)
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null)

  const handleDeleteUserSubmit = async (userId: string, mode: 'deactivate' | 'activate' | 'hard_delete') => {
    setDeleteUserError(null)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('userId', userId)
      formData.set('mode', mode)

      const result = await manageUserStatusAction(formData)
      if (result?.error) {
        setDeleteUserError(result.error)
        toast.error(result.error)
      } else if (result?.success) {
        if (mode === 'hard_delete') {
          toast.success('Pomyślnie usunięto konto użytkownika.')
          setUsers(prev => prev.filter(u => u.id !== userId))
        } else if (mode === 'deactivate') {
          toast.success('Konto użytkownika zostało pomyślnie zablokowane.')
          setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: false } : u))
        } else if (mode === 'activate') {
          toast.success('Konto użytkownika zostało pomyślnie odblokowane.')
          setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: true } : u))
        }

        setAuditLogs(prev => [
          {
            id: `local-del-${Date.now()}`,
            action: mode === 'deactivate' ? 'USER_DEACTIVATED' : mode === 'activate' ? 'USER_ACTIVATED' : 'USER_HARD_DELETED',
            performed_by: 'super_admin',
            payload: {
              target_user_id: userId,
              changed_at: new Date().toISOString()
            },
            created_at: new Date().toISOString()
          },
          ...prev
        ])

        setDeleteUserTarget(null)
      }
    })
  }

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetPasswordUser) return
    setResetPasswordError(null)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('userId', resetPasswordUser.id)

      const result = await resetUserPasswordAction(formData)
      if (result?.error) {
        setResetPasswordError(result.error)
      } else if (result?.success) {
        setAuditLogs(prev => [
          {
            id: `local-pw-${Date.now()}`,
            action: 'password_reset',
            performed_by: 'super_admin',
            payload: {
              target_user_id: resetPasswordUser.id,
              changed_at: new Date().toISOString()
            },
            created_at: new Date().toISOString()
          },
          ...prev
        ])

        setStatusMessage({
          type: 'success',
          text: `Pomyślnie wysłano bezpieczny link do zresetowania hasła na adres ${resetPasswordUser.email}.`
        })

        setResetPasswordUser(null)
      }
    })
  }

  const handleChangeRoleClick = (user: UserItem) => {
    setChangeRoleUser(user)
    const initialNewRole = AVAILABLE_ROLES.find(r => r.id !== user.role)?.id || AVAILABLE_ROLES[0]?.id || ''
    setChangeRoleSelectedRole(initialNewRole)
    setChangeRoleError(null)
  }

  const handleConfirmChangeRole = (e: React.FormEvent) => {
    e.preventDefault()
    if (!changeRoleUser || !changeRoleSelectedRole) return
    if (changeRoleSelectedRole === changeRoleUser.role) return

    setChangeRoleError(null)
    setStatusMessage(null)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('userId', changeRoleUser.id)
      formData.set('role', changeRoleSelectedRole)

      const result = await updateUserRoleAction(formData)
      if (result?.error) {
        setChangeRoleError(result.error)
        setStatusMessage({ type: 'error', text: result.error })
        toast.error(result.error)
      } else {
        const targetId = changeRoleUser.id
        const newRole = changeRoleSelectedRole
        setStatusMessage({ type: 'success', text: `Pomyślnie zaktualizowano rolę dla użytkownika ${changeRoleUser.email}.` })
        toast.success('Pomyślnie zaktualizowano rolę dla użytkownika')
        setUsers(prev => prev.map(u => u.id === targetId ? { ...u, role: newRole } : u))
        setChangeRoleUser(null)
      }
    })
  }

  return {
    users,
    auditLogs,
    statusMessage,
    isPending: isPending || addUser.isPending,
    changeRoleUser,
    setChangeRoleUser,
    changeRoleSelectedRole,
    setChangeRoleSelectedRole,
    changeRoleError,
    handleChangeRoleClick,
    handleConfirmChangeRole,
    isAddUserOpen: addUser.isOpen,
    setIsAddUserOpen: addUser.setIsOpen,
    newEmail: addUser.email,
    setNewEmail: addUser.setEmail,
    newRole: addUser.role,
    setNewRole: addUser.setRole,
    newPassword: addUser.password,
    setNewPassword: addUser.setPassword,
    newOrgId: addUser.orgId,
    setNewOrgId: addUser.setOrgId,
    addUserError: addUser.error,
    createdCredentials: addUser.createdCredentials,
    setCreatedCredentials: addUser.setCreatedCredentials,
    handleCreateUser: addUser.handleCreateUser,
    resetPasswordUser,
    setResetPasswordUser,
    resetPasswordError,
    setResetPasswordError,
    handleResetPassword,
    deleteUserTarget,
    setDeleteUserTarget,
    deleteUserError,
    setDeleteUserError,
    handleDeleteUserSubmit,
  }
}
