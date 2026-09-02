'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function OnboardingModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // FAM-ONBOARDING - pokazujemy tylko za pierwszym razem dla rodziny
    const hasSeen = localStorage.getItem('silvercare_onboarding_seen')
    if (!hasSeen) {
      setOpen(true)
    }
  }, [])

  const handleClose = () => {
    localStorage.setItem('silvercare_onboarding_seen', 'true')
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) handleClose()
    }}>
      <DialogContent className="sm:max-w-md bg-surface text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl">Witaj w Silver Care! 👋</DialogTitle>
          <DialogDescription className="pt-2 text-base text-text-secondary">
            System Silver Care ułatwia komunikację z naszą placówką opiekuńczą i na bieżąco informuje Cię o pobycie Twojego bliskiego.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 text-sm text-text-secondary">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-full text-primary shrink-0 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <div>
              <strong className="text-foreground block mb-1">Codzienne raporty</strong>
              Personel publikuje informacje o ogólnym nastroju i aktywnościach podopiecznego (np. długość snu, spacery).
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-full text-primary shrink-0 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path></svg>
            </div>
            <div>
              <strong className="text-foreground block mb-1">Wiadomości i kontakt</strong>
              Z poziomu panelu możesz zadać nam pytanie. Zostanie ono przeczytane przez administrację przy najbliższej okazji.
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-end">
          <Button type="button" onClick={handleClose}>
            Rozumiem, przejdź do panelu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
