'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Copy, Check } from 'lucide-react'

export interface CreateOrgSuccessInfo {
  orgName: string
  adminEmail: string
  inviteUrl?: string | null
  emailSent?: boolean
}

interface CreateOrgSuccessBannerProps {
  info: CreateOrgSuccessInfo
  onClose: () => void
}

export function CreateOrgSuccessBanner({ info, onClose }: CreateOrgSuccessBannerProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Placówka „{info.orgName}” została pomyślnie utworzona!
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {info.emailSent
                ? `Wysłano e-mail z zaproszeniem na adres ${info.adminEmail}.`
                : `Konto pierwszego administratora (${info.adminEmail}) zostało przygotowane.`
              }
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground font-medium min-h-touch px-2"
        >
          Zamknij
        </button>
      </div>

      {info.inviteUrl && (
        <div className="pt-2 border-t border-primary/10 flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-sm text-muted-foreground font-medium shrink-0">
            Link aktywacyjny:
          </span>
          <input
            readOnly
            value={info.inviteUrl}
            className="text-sm font-mono bg-card px-3 py-1.5 rounded-lg border border-border flex-1 truncate text-foreground min-h-touch"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleCopy(info.inviteUrl!)}
            className="min-h-touch text-sm shrink-0 rounded-lg gap-1.5 px-3"
          >
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Skopiowano' : 'Kopiuj link'}
          </Button>
        </div>
      )}
    </div>
  )
}
