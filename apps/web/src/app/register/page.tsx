'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Loader2, AlertCircle } from 'lucide-react'
import { RegisterLoadingCard, RegisterErrorCard, RegisterSuccessCard } from '@/components/auth/RegisterStateCards'
import { RegisterConsentsSection } from '@/components/auth/RegisterConsentsSection'
import { useRegisterToken } from '@/components/auth/useRegisterToken'
import { roleLabel } from '@/lib/auth/role-labels'

function RegisterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const { uiState, setUiState, errorMessage, errorStatus, maskedEmail, role } = useRegisterToken(token)

  // Formularz
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptDataProcessing, setAcceptDataProcessing] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  if (uiState === 'LOADING') {
    return <RegisterLoadingCard />
  }

  if (uiState === 'ERROR') {
    return (
      <RegisterErrorCard
        errorStatus={errorStatus}
        errorMessage={errorMessage}
        onLogin={() => router.push('/login')}
        onHome={() => router.push('/')}
      />
    )
  }

  if (uiState === 'SUCCESS') {
    return (
      <RegisterSuccessCard
        isGuardian={isGuardian}
        onLogin={() => router.push('/login?message=Konto+zostało+aktywowane.+Możesz+się+zalogować.')}
      />
    )
  }

  return (
    <Card className="w-full max-w-md shadow-lg border-border">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-3 flex justify-center">
          <Logo width={150} height={42} className="h-9 w-auto object-contain" priority />
        </div>
        <CardTitle className="text-2xl font-bold text-foreground">Dołącz do Silver Care</CardTitle>
        <CardDescription className="text-text-secondary">
          Ustaw bezpieczne hasło, aby aktywować dostęp do portalu bliskich.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-surface-sunken p-3 text-sm space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">Adres e-mail:</span>
            <span className="font-medium text-foreground">{maskedEmail || 'Twój adres e-mail'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">Przyznana rola:</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-semibold ${
              isGuardian ? 'bg-primary/15 text-primary' : 'bg-secondary text-secondary-foreground'
            }`}>
              {roleLabel(isGuardian ? 'legal_guardian' : 'family')}
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

          <RegisterConsentsSection
            acceptTerms={acceptTerms}
            setAcceptTerms={setAcceptTerms}
            acceptDataProcessing={acceptDataProcessing}
            setAcceptDataProcessing={setAcceptDataProcessing}
            isGuardian={isGuardian}
            disabled={isSubmitting}
          />

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
            <div className="relative flex justify-center text-sm uppercase">
              <span className="bg-card px-2 text-muted-foreground">lub</span>
            </div>
          </div>

          <Button 
            type="button" 
            variant="outline" 
            className="w-full text-sm" 
            disabled={isSubmitting || !consentsValid}
            onClick={async () => {
              if (!token || !consentsValid) return
              setIsSubmitting(true)
              document.cookie = `invite_token=${token}; path=/; max-age=3600; SameSite=Lax`
              document.cookie = `invite_consents_accepted=true; path=/; max-age=3600; SameSite=Lax`
              
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
