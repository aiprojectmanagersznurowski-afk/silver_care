'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function RegisterPage() {
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
    <div className="flex min-h-screen items-center justify-center bg-surface-sunken p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Zarejestruj się</CardTitle>
          <CardDescription>
            Ustaw hasło dla swojego konta, aby uzyskać dostęp do panelu bliskich.
          </CardDescription>
        </CardHeader>
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
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
