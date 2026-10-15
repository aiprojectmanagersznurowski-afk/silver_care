'use client'

import { ShieldAlert, CheckCircle2 } from 'lucide-react'
import { UserTable } from './iam/UserTable'
import { ChangeRoleDialog } from './iam/ChangeRoleDialog'
import { ResetPasswordDialog } from './iam/ResetPasswordDialog'
import { DeleteUserDialog } from './iam/DeleteUserDialog'
import { AuditLogTable } from './iam/AuditLogTable'
import { CreatedCredentialsBanner } from './iam/CreatedCredentialsBanner'
import { IamLoadingState, IamErrorState, IamEmptyState } from './iam/IamFeedbackStates'
import { useIamManagement } from './iam/useIamManagement'
import {
  UserItem,
  AuditLogItem,
  IamManagementClientProps,
  ROLE_LABELS,
  AVAILABLE_ROLES
} from './iam/iam-types'

export type { UserItem, AuditLogItem, IamManagementClientProps }

export function IamManagementClient({
  initialUsers,
  initialAuditLogs,
  currentUserId,
  forcedState,
  errorMessage
}: IamManagementClientProps) {
  const {
    users,
    auditLogs,
    statusMessage,
    isPending,
    changeRoleUser,
    setChangeRoleUser,
    changeRoleSelectedRole,
    setChangeRoleSelectedRole,
    changeRoleError,
    handleChangeRoleClick,
    handleConfirmChangeRole,
    isAddUserOpen,
    setIsAddUserOpen,
    newEmail,
    setNewEmail,
    newRole,
    setNewRole,
    newPassword,
    setNewPassword,
    newOrgId,
    setNewOrgId,
    addUserError,
    createdCredentials,
    setCreatedCredentials,
    handleCreateUser,
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
  } = useIamManagement(initialUsers, initialAuditLogs)

  const currentState = forcedState || (errorMessage ? 'error' : users.length === 0 ? 'empty' : 'success')

  if (currentState === 'loading') {
    return <IamLoadingState />
  }

  if (currentState === 'error') {
    return <IamErrorState errorMessage={errorMessage} />
  }

  if (currentState === 'empty') {
    return <IamEmptyState />
  }

  return (
    <div className="space-y-8">
      {statusMessage && (
        <div
          role="status"
          className={`flex items-center gap-3 rounded-xl p-4 text-sm font-medium ${
            statusMessage.type === 'success'
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <ShieldAlert className="h-5 w-5 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {createdCredentials && (
        <CreatedCredentialsBanner
          credentials={createdCredentials}
          onClose={() => setCreatedCredentials(null)}
        />
      )}

      {/* Sekcja 1: Użytkownicy i Uprawnienia */}
      <UserTable
        users={users}
        onChangeRoleClick={handleChangeRoleClick}
        onResetPasswordClick={user => {
          setResetPasswordUser(user)
          setResetPasswordError(null)
        }}
        onDeleteUserClick={user => {
          setDeleteUserTarget(user)
          setDeleteUserError(null)
        }}
        currentUserId={currentUserId}
        roleLabels={ROLE_LABELS}
        addUserProps={{
          isOpen: isAddUserOpen,
          onOpenChange: setIsAddUserOpen,
          newEmail,
          onEmailChange: setNewEmail,
          newRole,
          onRoleChange: setNewRole,
          newPassword,
          onPasswordChange: setNewPassword,
          newOrgId,
          onOrgIdChange: setNewOrgId,
          availableRoles: AVAILABLE_ROLES,
          error: addUserError,
          isPending,
          onSubmit: handleCreateUser,
        }}
      />

      {/* Dialog zmiany uprawnień i roli */}
      <ChangeRoleDialog
        user={changeRoleUser}
        selectedRole={changeRoleSelectedRole}
        onRoleChange={setChangeRoleSelectedRole}
        availableRoles={AVAILABLE_ROLES}
        roleLabels={ROLE_LABELS}
        isPending={isPending}
        error={changeRoleError}
        onSubmit={handleConfirmChangeRole}
        onClose={() => setChangeRoleUser(null)}
      />

      {/* Dialog resetowania hasła (AC1: bezpieczny link e-mail) */}
      <ResetPasswordDialog
        user={resetPasswordUser}
        error={resetPasswordError}
        isPending={isPending}
        onSubmit={handleResetPassword}
        onClose={() => setResetPasswordUser(null)}
      />

      {/* Dialog zarządzania statusem / blokady i usuwania konta */}
      <DeleteUserDialog
        user={deleteUserTarget}
        isPending={isPending}
        error={deleteUserError}
        onSubmit={handleDeleteUserSubmit}
        onClose={() => setDeleteUserTarget(null)}
      />

      {/* Sekcja 2: Zintegrowany Rejestr Audytu Zmian Uprawnień */}
      <AuditLogTable
        auditLogs={auditLogs}
        users={users}
        availableRoles={AVAILABLE_ROLES}
        formatDateTime={dtString => dtString ? new Date(dtString).toLocaleString('pl-PL') : '—'}
      />
    </div>
  )
}
