'use client'

import { useTransition } from 'react'
import { stopImpersonationAction, ImpersonationSession } from '@/actions/impersonation'
import { ShieldAlert, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ImpersonationBanner({ session }: { session: ImpersonationSession }) {
  const [isPending, startTransition] = useTransition()

  const handleStop = () => {
    startTransition(async () => {
      await stopImpersonationAction()
    })
  }

  return (
    <div
      role="alert"
      className="bg-foreground text-background px-4 py-2.5 text-sm font-medium flex items-center justify-between gap-4 border-b border-border sticky top-0 z-50 animate-in fade-in slide-in-from-top duration-200"
    >
      <div className="flex items-center gap-2.5 truncate">
        <ShieldAlert className="h-5 w-5 shrink-0 text-background" />
        <span className="truncate">
          Działasz w trybie impersonacji jako Administrator Placówki: <strong>{session.targetOrgName}</strong> ({session.adminEmail})
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="hidden md:inline text-xs text-background/80">
          Akcje destrukcyjne są zablokowane
        </span>
        <Button
          onClick={handleStop}
          disabled={isPending}
          size="sm"
          className="bg-background hover:bg-background/90 text-foreground text-xs font-semibold rounded-lg h-7 px-3"
        >
          <LogOut className="h-3.5 w-3.5 mr-1.5" />
          {isPending ? 'Kończenie...' : 'Zakończ podgląd'}
        </Button>
      </div>
    </div>
  )
}
