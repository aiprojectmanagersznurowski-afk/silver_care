'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function FeatureFlagsMfa() {
  const router = useRouter()
  const [factor, setFactor] = useState<{ id: string; secret?: string }>()
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function prepare() {
    startTransition(async () => {
      setError('')
      const { mfa } = createClient().auth
      const { data: factors, error: listError } = await mfa.listFactors()
      if (listError) {
        setError('Nie udało się sprawdzić metod uwierzytelniania.')
        return
      }
      const existing = factors.totp[0]
      if (existing) {
        setFactor({ id: existing.id })
        return
      }
      const { data, error: enrollmentError } = await mfa.enroll({ factorType: 'totp', issuer: 'Silver Care' })
      if (enrollmentError || !data) {
        setError('Nie udało się skonfigurować uwierzytelniania.')
        return
      }
      setFactor({ id: data.id, secret: data.totp.secret })
    })
  }

  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!factor) return
    const code = String(new FormData(event.currentTarget).get('code') ?? '')
    if (!/^\d{6}$/.test(code)) return
    startTransition(async () => {
      setError('')
      const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId: factor.id, code })
      if (verifyError) {
        setError('Nie udało się potwierdzić kodu. Sprawdź aktualny kod w aplikacji uwierzytelniającej.')
        return
      }
      setFactor(undefined)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4 text-sm">
      <p>Potwierdź drugi składnik uwierzytelniania, aby zmienić moduły placówki.</p>
      {factor ? (
        <form className="space-y-3" onSubmit={verify}>
          {factor.secret && (
            <p className="break-all">
              Dodaj ten klucz w aplikacji uwierzytelniającej jako klucz oparty na czasie.{' '}
              <code data-testid="feature-flags-totp-secret">{factor.secret}</code>
            </p>
          )}
          <label className="block space-y-1">
            <span>Kod uwierzytelniający</span>
            <Input required name="code" autoComplete="one-time-code" inputMode="numeric"
              pattern="[0-9]{6}" maxLength={6} className="min-h-touch max-w-48" />
          </label>
          <Button type="submit" className="min-h-touch" disabled={pending}>Potwierdź kod</Button>
        </form>
      ) : (
        <Button type="button" className="min-h-touch" onClick={prepare} disabled={pending}>
          Skonfiguruj uwierzytelnianie
        </Button>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
