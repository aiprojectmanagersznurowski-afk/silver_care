'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface InviteFamilySuccessAlertProps {
  generatedUrl: string | null
  onClose: () => void
}

export function InviteFamilySuccessAlert({
  generatedUrl,
  onClose,
}: InviteFamilySuccessAlertProps) {
  if (!generatedUrl) {
    return (
      <div className="mt-4 p-4 border border-border bg-card rounded-md space-y-2">
        <p className="text-sm font-semibold text-foreground">
          Zaproszenie wysłane pomyślnie!
        </p>
        <p className="text-sm text-muted-foreground">
          Wiadomość z linkiem aktywacyjnym została wysłana na podany adres e-mail bliskiego.
        </p>
        <Button 
          type="button" 
          variant="default" 
          className="w-full mt-2 min-h-touch" 
          onClick={onClose}
        >
          Zamknij i odśwież
        </Button>
      </div>
    )
  }

  return (
    <div className="mt-4 p-4 border border-border bg-card rounded-md space-y-2">
      <p className="text-sm font-semibold text-foreground">
        Zaproszenie wygenerowane pomyślnie!
      </p>
      <p className="text-sm text-muted-foreground">
        Wyślij poniższy link bliskim podopiecznego, aby umożliwić założenie konta:
      </p>
      <div className="flex items-center gap-2 mt-2">
        <Input readOnly value={generatedUrl} className="text-sm font-mono min-h-touch" />
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          className="min-h-touch px-4 text-sm"
          onClick={() => {
            navigator.clipboard.writeText(generatedUrl)
            toast.success('Link zaproszenia skopiowano do schowka!')
          }}
        >
          Kopiuj
        </Button>
      </div>
      <Button 
        type="button" 
        variant="default" 
        className="w-full mt-2 min-h-touch" 
        onClick={onClose}
      >
        Zamknij i odśwież
      </Button>
    </div>
  )
}
