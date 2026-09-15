'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { revealPeselAction } from '@/actions/identity'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, ShieldAlert, Clock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { maskNationalId } from '@/lib/identity_crypto'

interface PeselRevealProps {
  residentId: string
  maskedValue?: string
}

export function PeselReveal({ residentId, maskedValue = '•••••••••••' }: PeselRevealProps) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('NFZ_RECEPTA')
  const [revealedValue, setRevealedValue] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number>(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Transient timer (30 seconds)
  useEffect(() => {
    if (!revealedValue || secondsLeft <= 0) {
      if (revealedValue && secondsLeft <= 0) {
        setRevealedValue(null)
      }
      return
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRevealedValue(null)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [revealedValue, secondsLeft])

  const handleRevealSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const formData = new FormData()
    formData.append('residentId', residentId)
    formData.append('password', password)
    formData.append('reason', reason)

    startTransition(async () => {
      const res = await revealPeselAction(formData)
      if (res.error) {
        setErrorMsg(res.error)
      } else if (res.revealedValue) {
        setRevealedValue(res.revealedValue)
        setSecondsLeft(30)
        setIsOpen(false)
        setPassword('')
      }
    })
  }

  const handleHide = () => {
    setRevealedValue(null)
    setSecondsLeft(0)
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="font-mono text-sm tracking-wider font-semibold text-slate-800">
        {revealedValue || maskNationalId(maskedValue)}
      </span>

      {revealedValue ? (
        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
          <Clock className="h-3 w-3 animate-pulse" />
          <span>{secondsLeft}s</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-1 text-slate-500 hover:text-slate-800"
            onClick={handleHide}
            title="Ukryj natychmiast"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-slate-400 hover:text-slate-700"
          onClick={() => {
            setErrorMsg(null)
            setIsOpen(true)
          }}
          title="Odsłoń PESEL (Wymaga hasła)"
        >
          <Eye className="h-4 w-4" />
        </Button>
      )}

      {/* Modal Step-Up Auth */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <ShieldAlert className="h-5 w-5 text-indigo-600" />
              Autoryzacja Krokowa (PESEL)
            </DialogTitle>
            <DialogDescription>
              Wgląd w numer PESEL podopiecznego jest ściśle audytowany. Potwierdź swoją tożsamość hasłem i wskaż powód.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRevealSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 text-xs text-red-700 bg-red-50 rounded-md border border-red-200">
                {errorMsg}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">Powód wglądu</Label>
              <select
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="NFZ_RECEPTA">NFZ / Wystawienie Recepty</option>
                <option value="PRZYJECIE_SZPITAL">Pilne Przyjęcie do Szpitala / Pogotowie</option>
                <option value="DOKUMENTACJA_ZUS">Oficjalna Dokumentacja ZUS / Emerytura</option>
                <option value="KARTA_ZDROWIA">Uzupełnienie Karty Podopiecznego</option>
                <option value="INNE">Inny powód służbowy</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stepUpPassword">Twoje hasło pracownika</Label>
              <Input
                id="stepUpPassword"
                type="password"
                required
                disabled={isPending}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Wpisz bieżące hasło"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} disabled={isPending}>
                Anuluj
              </Button>
              <Button type="submit" disabled={isPending || !password}>
                {isPending ? 'Weryfikacja...' : 'Odsłoń na 30 sekund'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
