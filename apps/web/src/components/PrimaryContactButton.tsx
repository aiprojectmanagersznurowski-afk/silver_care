'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Star, Loader2 } from 'lucide-react'
import { setPrimaryRelativeAction } from '@/actions/resident-relative'
import { toast } from 'sonner'

interface PrimaryContactButtonProps {
  linkId: string
  residentId: string
  isPrimary: boolean
}

export function PrimaryContactButton({ linkId, residentId, isPrimary }: PrimaryContactButtonProps) {
  const [loading, setLoading] = useState(false)

  if (isPrimary) {
    return (
      <span
        data-testid="badge-primary-contact"
        className="inline-flex items-center gap-1 text-sm font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full"
      >
        <Star className="w-3 h-3 fill-primary text-primary" />
        Główny kontakt
      </span>
    )
  }

  const handleSetPrimary = async () => {
    setLoading(true)
    const res = await setPrimaryRelativeAction(linkId, residentId)
    setLoading(false)

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('Pomyślnie ustawiono jako kontakt główny.')
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      data-testid="btn-set-primary-contact"
      onClick={handleSetPrimary}
      disabled={loading}
      className="text-sm text-muted-foreground hover:text-foreground gap-1.5 h-7 px-2"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
      Ustaw jako główny
    </Button>
  )
}
