'use client'

import { useRef } from 'react'
import { LogIn, Mail } from 'lucide-react'
import { startImpersonationAction } from '@/actions/impersonation'
import { useResendAdminInvite } from '@/components/AdminInviteActions'
import { RowActions } from '@/components/patterns/RowActions'

interface OrgAdminRowActionsProps {
  adminId: string
  adminEmail: string
  organizationId: string
  organizationName: string
}

/** Akcje kierownika placówki w menu „⋯": ponowienie zaproszenia i wejście w tryb podglądu. */
export function OrgAdminRowActions({ adminId, adminEmail, organizationId, organizationName }: OrgAdminRowActionsProps) {
  const invite = useResendAdminInvite({ adminEmail, organizationId, organizationName })
  const impersonateForm = useRef<HTMLFormElement>(null)

  return (
    <RowActions
      label="Kierownik placówki"
      actions={[
        {
          label: invite.isPending ? 'Wysyłanie...' : 'Wyślij zaproszenie',
          icon: Mail,
          disabled: invite.isPending,
          hint: 'Wyślij e-mail z zaproszeniem lub wygeneruj link aktywacyjny',
          onSelect: invite.resend,
        },
        {
          label: 'Zaloguj jako',
          icon: LogIn,
          hint: 'Zaloguj jako ten kierownik placówki',
          onSelect: () => impersonateForm.current?.requestSubmit(),
        },
      ]}
    >
      {invite.dialog}
      <form ref={impersonateForm} action={startImpersonationAction} hidden>
        <input type="hidden" name="targetAdminId" value={adminId} />
        <input type="hidden" name="targetOrgId" value={organizationId} />
        <input type="hidden" name="targetOrgName" value={organizationName} />
        <input type="hidden" name="adminEmail" value={adminEmail} />
      </form>
    </RowActions>
  )
}
