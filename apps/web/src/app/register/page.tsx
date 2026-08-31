'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

function RegisterForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setError('Brak tokena rejestracji. Upewnij się, że używasz linku z e-maila.')
    }
  }, [token])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    if (password !== confirmPassword) {
      setError('Hasła nie są identyczne.')
      return
    }

    if (password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/family/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        // Po pomyślnej rejestracji przekieruj na login z komunikatem
        router.push('/login?message=Konto+zostało+utworzone.+Możesz+się+zalogować.')
      } else {
        setError(data.error || 'Wystąpił błąd podczas rejestracji.')
      }
    } catch {
      setError('Błąd komunikacji z serwerem.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <CardContent>
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      
      <form onSubmit={handleRegister} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Nowe hasło</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!token || isSubmitting}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Potwierdź hasło</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={!token || isSubmitting}
            required
          />
        </div>
        <Button 
          type="submit" 
          className="w-full" 
          disabled={!token || isSubmitting}
        >
          {isSubmitting ? 'Trwa rejestracja...' : 'Utwórz konto'}
        </Button>

        <div className="relative w-full py-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Albo
            </span>
          </div>
        </div>

        <Button 
          type="button" 
          variant="outline" 
          className="w-full" 
          disabled={!token || isSubmitting}
          onClick={async () => {
            if (!token) return
            setIsSubmitting(true)
            
            // Zapisz token w ciasteczku przed przekierowaniem do OAuth
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
  )
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-sunken p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Zarejestruj się</CardTitle>
          <CardDescription>
            Ustaw hasło dla swojego konta, aby uzyskać dostęp do panelu bliskich.
          </CardDescription>
        </CardHeader>
        <Suspense fallback={<CardContent className="text-center py-4">Ładowanie...</CardContent>}>
          <RegisterForm />
        </Suspense>
      </Card>
    </div>
  )
}
