'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function FeatureFlagsMfa({
  needsVerification, description = 'Potwierdź drugi składnik uwierzytelniania, aby zmienić moduły placówki.',
}: { needsVerification: boolean; description?: string }) {
  const router = useRouter()
  const [factor, setFactor] = useState<{ id: string; enrollment?: { secret: string; qrCode: string } }>()
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
      for (const pendingFactor of factors.all) {
        if (pendingFactor.factor_type !== 'totp' || pendingFactor.status !== 'unverified') continue
        const { error: removalError } = await mfa.unenroll({ factorId: pendingFactor.id })
        if (removalError && removalError.code !== 'mfa_factor_not_found') {
          setError('Nie udało się wznowić konfiguracji uwierzytelniania. Spróbuj ponownie.')
          return
        }
      }
      const { data, error: enrollmentError } = await mfa.enroll({ factorType: 'totp', issuer: 'Silver Care' })
      if (enrollmentError || !data) {
        setError('Nie udało się skonfigurować uwierzytelniania.')
        return
      }
      const qrMarkup = data.totp.qr_code.slice(data.totp.qr_code.indexOf(',') + 1)
      setFactor({ id: data.id, enrollment: {
        secret: data.totp.secret, qrCode: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrMarkup)}`,
      } })
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
      <p>{description}</p>
      {factor ? (
        <form className="space-y-3" onSubmit={verify}>
          {factor.enrollment && (
            <div className="space-y-2">
              <p>Zeskanuj kod QR w aplikacji uwierzytelniającej lub wpisz klucz ręcznie.</p>
              <Image unoptimized src={factor.enrollment.qrCode} alt="Kod QR do konfiguracji uwierzytelniania" width={160} height={160} />
              <code data-testid="feature-flags-totp-secret" className="break-all">{factor.enrollment.secret}</code>
            </div>
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
          {needsVerification ? 'Wpisz kod uwierzytelniający' : 'Skonfiguruj uwierzytelnianie'}
        </Button>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
