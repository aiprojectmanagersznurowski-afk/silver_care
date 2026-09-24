'use client'

import { useState, useTransition } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { updateUserRoleAction, createUserWithRoleAction, resetUserPasswordAction } from '@/actions/iam'
import { ShieldAlert, CheckCircle2, UserCog, RefreshCw, AlertCircle, Key, Copy, Check } from 'lucide-react'
import { ROLES } from '@silvercare/contracts/src/generated/roles'

import { UserTable } from './iam/UserTable'
import { ResetPasswordDialog } from './iam/ResetPasswordDialog'
import { AuditLogTable } from './iam/AuditLogTable'

export interface UserItem {
  id: string
  email: string
  role: string
  organizationId?: string | null
  lastSignInAt?: string | null
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
  forcedState?: 'loading' | 'empty' | 'success' | 'error'
  errorMessage?: string
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin (Globalny)',
  org_admin: 'Administrator Placówki (Org Admin)',
  nurse: 'Personel Opiekuńczy (Nurse)',
  legal_guardian: 'Opiekun Prawny (Legal Guardian)',
  family: 'Członek Rodziny (Family)',
}

const AVAILABLE_ROLES = ROLES.map(r => ({
  id: r.id,
  label: ROLE_LABELS[r.id] || r.id,
}))

export function IamManagementClient({
  initialUsers,
  initialAuditLogs,
  forcedState,
  errorMessage
}: IamManagementClientProps) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers)
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(initialAuditLogs)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  // Stan dialogu dodawania użytkownika
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('nurse')
  const [newPassword, setNewPassword] = useState('')
  const [newOrgId, setNewOrgId] = useState('')
  const [addUserError, setAddUserError] = useState<string | null>(null)
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string
    role: string
    temporaryPassword?: string
  } | null>(null)
  const [copiedPassword, setCopiedPassword] = useState(false)

  // Stan dialogu resetowania / nadawania hasła
  const [resetPasswordUser, setResetPasswordUser] = useState<UserItem | null>(null)
  const [customPassword, setCustomPassword] = useState('')
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null)
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState<{
    email: string
    newPassword?: string
  } | null>(null)
  const [copiedResetPassword, setCopiedResetPassword] = useState(false)

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetPasswordUser) return
    setResetPasswordError(null)

    if (customPassword.trim() && customPassword.trim().length < 6) {
      setResetPasswordError('Nowe hasło musi mieć co najmniej 6 znaków.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('userId', resetPasswordUser.id)
      if (customPassword.trim()) {
        formData.set('password', customPassword.trim())
      }

      const result = await resetUserPasswordAction(formData)
      if (result?.error) {
        setResetPasswordError(result.error)
      } else if (result?.newPassword) {
        setResetPasswordSuccess({
          email: resetPasswordUser.email,
          newPassword: result.newPassword
        })

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
          text: `Pomyślnie zaktualizowano hasło dla użytkownika ${resetPasswordUser.email}.`
        })

        setResetPasswordUser(null)
        setCustomPassword('')
      }
    })
  }

  // Stan UI wymuszany przez prop (np. w Storybooku / testach) lub obliczany
  const currentState = forcedState || (errorMessage ? 'error' : users.length === 0 ? 'empty' : 'success')

  const handleRoleSelect = (userId: string, newRole: string) => {
    setSelectedRoles(prev => ({ ...prev, [userId]: newRole }))
  }

  const handleApplyRole = (userId: string) => {
    const newRole = selectedRoles[userId]
    if (!newRole) return

    setStatusMessage(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('userId', userId)
      formData.set('role', newRole)

      const result = await updateUserRoleAction(formData)
      if (result?.error) {
        setStatusMessage({ type: 'error', text: result.error })
      } else {
        setStatusMessage({ type: 'success', text: `Pomyślnie zaktualizowano rolę dla użytkownika.` })
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      }
    })
  }

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault()
    setAddUserError(null)

    if (!newEmail.trim()) {
      setAddUserError('Adres e-mail jest wymagany.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('email', newEmail.trim())
      formData.set('role', newRole)
      if (newPassword.trim()) {
        formData.set('password', newPassword.trim())
      }
      if (newOrgId.trim()) {
        formData.set('organizationId', newOrgId.trim())
      }

      const result = await createUserWithRoleAction(formData)
      if (result?.error) {
        setAddUserError(result.error)
      } else if (result?.user) {
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

        // Dopisanie do lokalnego widoku audytu
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

        // Reset pól formularza
        setNewEmail('')
        setNewPassword('')
        setNewOrgId('')
        setNewRole('nurse')
        setIsAddUserOpen(false)
      }
    })
  }

  // 1. Stan LOADING (Szkielet UI)
  if (currentState === 'loading') {
    return (
      <div className="space-y-8 animate-pulse" aria-busy="true" aria-label="Ładowanie panelu uprawnień">
        <div className="h-10 w-72 rounded-xl bg-slate/10" />
        <div className="h-64 rounded-2xl bg-slate/10" />
        <div className="h-64 rounded-2xl bg-slate/10" />
      </div>
    )
  }

  // 2. Stan ERROR (Błąd z opcją ponowienia)
  if (currentState === 'error') {
    return (
      <Card className="rounded-2xl border-destructive/20 bg-destructive/5 p-8 text-center" role="alert">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-semibold text-slate mb-2">Błąd wczytywania danych IAM</h3>
        <p className="text-slate-soft max-w-md mx-auto mb-6">
          {errorMessage || 'Wystąpił problem podczas pobierania rejestru uprawnień lub użytkowników.'}
        </p>
        <Button
          onClick={() => window.location.reload()}
          className="min-h-[48px] rounded-xl px-6 bg-slate text-white hover:bg-slate/90"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Spróbuj ponownie
        </Button>
      </Card>
    )
  }

  // 3. Stan EMPTY (Stan pusty z czytelnym wyjaśnieniem)
  if (currentState === 'empty') {
    return (
      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5 p-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sage/10 text-sage mb-4">
          <UserCog className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-semibold text-slate mb-2">Brak zarejestrowanych kont</h3>
        <p className="text-slate-soft max-w-md mx-auto">
          W systemie nie odnaleziono jeszcze żadnych kont użytkowników. Gdy administratorzy placówek lub personel dołączą do platformy, pojawią się w tym panelu.
        </p>
      </Card>
    )
  }

  // 4. Stan SUCCESS (Pełny, interaktywny panel IAM i rejestr audytowy)
  return (
    <div className="space-y-8">
      {statusMessage && (
        <div
          role="status"
          className={`flex items-center gap-3 rounded-2xl p-4 text-sm font-medium ${
            statusMessage.type === 'success'
              ? 'bg-sage/10 text-sage border border-sage/20'
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
        <div className="rounded-2xl border border-sage/30 bg-sage/5 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sage font-semibold">
              <Key className="h-5 w-5" />
              <span>Utworzono nowe konto użytkownika!</span>
            </div>
            <button
              type="button"
              onClick={() => setCreatedCredentials(null)}
              className="text-slate-soft hover:text-slate text-sm font-medium"
            >
              Zamknij powiadomienie
            </button>
          </div>
          <p className="text-sm text-slate-soft">
            Przekaż poniższe dane logowania użytkownikowi. Hasło tymczasowe nie będzie ponownie widoczne w panelu.
          </p>
          <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-xl border border-slate/10 font-mono text-xs">
            <div><strong>E-mail:</strong> {createdCredentials.email}</div>
            <div><strong>Rola:</strong> {createdCredentials.role}</div>
            {createdCredentials.temporaryPassword && (
              <div className="flex items-center gap-2">
                <strong>Hasło:</strong> 
                <span className="bg-slate/5 px-2 py-1 rounded select-all">{createdCredentials.temporaryPassword}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(createdCredentials.temporaryPassword || '')
                    setCopiedPassword(true)
                    setTimeout(() => setCopiedPassword(false), 2000)
                  }}
                >
                  {copiedPassword ? <Check className="h-3 w-3 text-sage mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copiedPassword ? 'Skopiowano' : 'Kopiuj hasło'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {resetPasswordSuccess && (
        <div className="rounded-2xl border border-sage/30 bg-sage/5 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sage font-semibold">
              <Key className="h-5 w-5" />
              <span>Zaktualizowano hasło użytkownika!</span>
            </div>
            <button
              type="button"
              onClick={() => setResetPasswordSuccess(null)}
              className="text-slate-soft hover:text-slate text-sm font-medium"
            >
              Zamknij powiadomienie
            </button>
          </div>
          <p className="text-sm text-slate-soft">
            Hasło dla konta <strong>{resetPasswordSuccess.email}</strong> zostało zresetowane. Przekaż nowe dane logowania użytkownikowi:
          </p>
          <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-xl border border-slate/10 font-mono text-xs">
            <div><strong>E-mail:</strong> {resetPasswordSuccess.email}</div>
            {resetPasswordSuccess.newPassword && (
              <div className="flex items-center gap-2">
                <strong>Nowe hasło:</strong>
                <span className="bg-slate/5 px-2 py-1 rounded select-all font-semibold text-slate">{resetPasswordSuccess.newPassword}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(resetPasswordSuccess.newPassword || '')
                    setCopiedResetPassword(true)
                    setTimeout(() => setCopiedResetPassword(false), 2000)
                  }}
                >
                  {copiedResetPassword ? <Check className="h-3 w-3 text-sage mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copiedResetPassword ? 'Skopiowano' : 'Kopiuj hasło'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sekcja 1: Użytkownicy i Uprawnienia */}
      <UserTable
        users={users}
        selectedRoles={selectedRoles}
        onRoleSelect={handleRoleSelect}
        onApplyRole={handleApplyRole}
        onResetPasswordClick={user => {
          setResetPasswordUser(user)
          setCustomPassword('')
          setResetPasswordError(null)
        }}
        isPending={isPending}
        availableRoles={AVAILABLE_ROLES}
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

      {/* Dialog resetowania hasła */}
      <ResetPasswordDialog
        user={resetPasswordUser}
        customPassword={customPassword}
        onCustomPasswordChange={setCustomPassword}
        error={resetPasswordError}
        isPending={isPending}
        onSubmit={handleResetPassword}
        onClose={() => setResetPasswordUser(null)}
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
