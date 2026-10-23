'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Key, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

export interface CreatedCredentials {
  email: string
  role: string
  temporaryPassword?: string
}

interface CreatedCredentialsBannerProps {
  credentials: CreatedCredentials
  onClose: () => void
}

export function CreatedCredentialsBanner({ credentials, onClose }: CreatedCredentialsBannerProps) {
  const [copiedPassword, setCopiedPassword] = useState(false)

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary font-semibold">
          <Key className="h-5 w-5" />
          <span>Utworzono nowe konto użytkownika!</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-sm font-medium min-h-touch px-2"
        >
          Zamknij powiadomienie
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        Przekaż poniższe dane logowania użytkownikowi. Hasło tymczasowe nie będzie ponownie widoczne w panelu.
      </p>
      <div className="flex flex-wrap items-center gap-4 bg-card p-3 rounded-xl border border-border font-mono text-sm">
        <div><strong>E-mail:</strong> {credentials.email}</div>
        <div><strong>Rola:</strong> {credentials.role}</div>
        {credentials.temporaryPassword && (
          <div className="flex items-center gap-2">
            <strong>Hasło:</strong> 
            <span className="bg-muted/50 px-2 py-1 rounded select-all">{credentials.temporaryPassword}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-touch px-3 text-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(credentials.temporaryPassword || '')
                    setCopiedPassword(true)
                    toast.success('Hasło tymczasowe skopiowano do schowka')
                    setTimeout(() => setCopiedPassword(false), 2000)
                  }}
                >
                  {copiedPassword ? <Check className="h-3 w-3 text-primary mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copiedPassword ? 'Skopiowano' : 'Kopiuj hasło'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {copiedPassword ? 'Skopiowano!' : 'Kopiuj hasło tymczasowe do schowka'}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}
