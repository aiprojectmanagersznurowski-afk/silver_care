'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Loader2, AlertCircle, CheckCircle2, ShieldCheck, HeartHandshake } from 'lucide-react'

type UIState = 'LOADING' | 'ERROR' | 'FORM' | 'SUCCESS'

function RegisterContent() {
  const [uiState, setUiState] = useState<UIState>('LOADING')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [errorStatus, setErrorStatus] = useState<string>('')
  
  // Dane zaproszenia
  const [maskedEmail, setMaskedEmail] = useState<string>('')
  const [role, setRole] = useState<'family' | 'legal_guardian' | string>('family')

  // Formularz
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptDataProcessing, setAcceptDataProcessing] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setErrorStatus('MISSING_TOKEN')
      setErrorMessage('Brak tokena rejestracji. Upewnij się, że używasz linku przesłanego w wiadomości e-mail.')
      setUiState('ERROR')
      return
    }

    let isMounted = true

    async function checkToken() {
      try {
        setUiState('LOADING')
        const res = await fetch(`/api/family/invite/validate?token=${encodeURIComponent(token!)}`)
        const data = await res.json()

        if (!isMounted) return

        if (res.ok && data.valid) {
          setMaskedEmail(data.maskedEmail || '')
          setRole(data.role || 'family')
          setUiState('FORM')
        } else {
          setErrorStatus(data.status || 'INVALID')
          setErrorMessage(data.message || 'To zaproszenie jest nieprawidłowe lub straciło ważność.')
          setUiState('ERROR')
        }
      } catch (err) {
        if (!isMounted) return
        setErrorStatus('NETWORK_ERROR')
        setErrorMessage('Nie udało się nawiązać połączenia w celu weryfikacji zaproszenia.')
        setUiState('ERROR')
      }
    }

    checkToken()

    return () => {
      isMounted = false
    }
  }, [token])

  const consentsValid = acceptTerms && acceptDataProcessing
  const isGuardian = role === 'legal_guardian'

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    if (password !== confirmPassword) {
      setFormError('Hasła nie są identyczne.')
      return
    }

    if (password.length < 8) {
      setFormError('Hasło musi mieć co najmniej 8 znaków (wymóg bezpieczeństwa).')
      return
    }

    if (!consentsValid) {
      setFormError('Akceptacja regulaminu i oświadczeń jest wymagana.')
      return
    }

    setIsSubmitting(true)
    setFormError(null)

    try {
      const res = await fetch('/api/family/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, consentsAccepted: true }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setUiState('SUCCESS')
      } else {
        setFormError(data.error || 'Wystąpił błąd podczas rejestracji.')
      }
    } catch {
      setFormError('Błąd komunikacji z serwerem. Spróbuj ponownie.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 1. STAN: LOADING
  if (uiState === 'LOADING') {
    return (
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">Weryfikacja zaproszenia</h3>
            <p className="text-sm text-text-secondary">
              Sprawdzamy ważność linku i Twoje uprawnienia w systemie Silver Care...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 2. STAN: ERROR
  if (uiState === 'ERROR') {
    return (
      <Card className="w-full max-w-md shadow-lg border-destructive/20">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-bold text-foreground">
            {errorStatus === 'EXPIRED' && 'Zaproszenie wygasło'}
            {errorStatus === 'REVOKED' && 'Zaproszenie zostało odwołane'}
            {errorStatus === 'CLAIMED' && 'Zaproszenie zostało już wykorzystane'}
            {errorStatus === 'MISSING_TOKEN' && 'Brak tokena zaproszenia'}
            {(!['EXPIRED', 'REVOKED', 'CLAIMED', 'MISSING_TOKEN'].includes(errorStatus)) && 'Nieprawidłowe zaproszenie'}
          </CardTitle>
          <CardDescription className="text-sm text-text-secondary leading-relaxed">
            {errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <div className="rounded-lg bg-surface-sunken p-3 text-xs text-text-secondary space-y-1">
            <p className="font-semibold text-foreground">Co możesz zrobić?</p>
            <p>• Jeśli zaproszenie wygasło lub zostało odwołane, skontaktuj się z personelem placówki opiekuńczej, aby otrzymać nowy link.</p>
            <p>• Jeśli konto zostało już utworzone, przejdź do strony logowania.</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button 
            className="w-full" 
            onClick={() => router.push('/login')}
          >
            Przejdź do logowania
          </Button>
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => router.push('/')}
          >
            Strona główna
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // 3. STAN: SUCCESS
  if (uiState === 'SUCCESS') {
    return (
      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-bold text-foreground">
            Konto zostało aktywowane!
          </CardTitle>
          <CardDescription className="text-sm text-text-secondary leading-relaxed">
            Twoje konto w portalu Silver Care zostało pomyślnie skonfigurowane z rolą{' '}
            <span className="font-semibold text-foreground">
              {isGuardian ? 'Opiekuna prawnego' : 'Bliskiego'}
            </span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-surface-sunken p-3 text-xs text-text-secondary space-y-1">
            <p className="font-semibold text-foreground">Gotowe do użycia:</p>
            <p>• Dostęp do codziennych podsumowań i aktywności podopiecznego.</p>
            <p>• Możliwość bezpośredniego kontaktu z personelem placówki.</p>
            {isGuardian && (
              <p>• Uprawnienia do zarządzania zgodami i formalnościami opiekuńczymi.</p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full" 
            onClick={() => router.push('/login?message=Konto+zostało+aktywowane.+Możesz+się+zalogować.')}
          >
            Zaloguj się do portalu
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // 4. STAN: FORM (poprawny token)
  return (
    <Card className="w-full max-w-md shadow-lg border-border">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-3 flex justify-center">
          <Image
            src="/logo.png"
            alt="Silver Care"
            width={150}
            height={42}
            className="h-9 w-auto object-contain"
            priority
          />
        </div>
        <CardTitle className="text-2xl font-bold text-foreground">Dołącz do Silver Care</CardTitle>
        <CardDescription className="text-text-secondary">
          Ustaw bezpieczne hasło, aby aktywować dostęp do portalu bliskich.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Informacja o zaproszeniu */}
        <div className="rounded-lg border border-border bg-surface-sunken p-3 text-xs space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">Adres e-mail:</span>
            <span className="font-medium text-foreground">{maskedEmail || 'Twój adres e-mail'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">Przyznana rola:</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
              isGuardian ? 'bg-primary/15 text-primary' : 'bg-secondary text-secondary-foreground'
            }`}>
              {isGuardian ? 'Opiekun prawny' : 'Bliski / Rodzina'}
            </span>
          </div>
        </div>

        {formError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nowe hasło</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimum 8 znaków"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Powtórz nowe hasło</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Wpisz ponownie to samo hasło"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3 bg-surface-sunken">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Wymagane oświadczenia
            </p>
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                disabled={isSubmitting}
              />
              <span className="text-xs text-foreground leading-relaxed">
                Akceptuję regulamin korzystania z platformy Silver Care oraz zasady ochrony prywatności.
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptDataProcessing}
                onChange={(e) => setAcceptDataProcessing(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                disabled={isSubmitting}
              />
              <span className="text-xs text-foreground leading-relaxed">
                {isGuardian ? (
                  <>
                    Oświadczam, że jestem opiekunem prawnym pensjonariusza i wyrażam zgodę na przetwarzanie danych niezbędnych do opieki i generowania raportów dziennych (zgodnie z Art. 9 RODO).
                  </>
                ) : (
                  <>
                    Wyrażam zgodę na otrzymywanie podsumowań i raportów o pobycie mojego bliskiego w placówce.
                  </>
                )}
              </span>
            </label>
          </div>

          <Button 
            type="submit" 
            className="w-full font-semibold" 
            disabled={isSubmitting || !consentsValid}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Aktywacja konta...
              </span>
            ) : (
              'Aktywuj konto i dołącz'
            )}
          </Button>

          <div className="relative w-full py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">lub</span>
            </div>
          </div>

          <Button 
            type="button" 
            variant="outline" 
            className="w-full text-xs" 
            disabled={isSubmitting}
            onClick={async () => {
              if (!token) return
              setIsSubmitting(true)
              document.cookie = `invite_token=${token}; path=/; max-age=3600; SameSite=Lax`
              
              const supabase = createClient()
              await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                  redirectTo: `${window.location.origin}/auth/callback`
                }
              })
            }}
          >
            Zarejestruj się przez Google
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-sunken p-4">
      <Suspense fallback={
        <Card className="w-full max-w-md shadow-lg border-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-text-secondary">Ładowanie...</p>
          </CardContent>
        </Card>
      }>
        <RegisterContent />
      </Suspense>
    </div>
  )
}
