'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Sprawdzamy czy użytkownik faktycznie jest zalogowany (z tokenem z zaproszenia)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Jeśli nie ma sesji, ale w URL jest hash z tokenem, musimy poczekać aż Supabase go przetworzy
        const hash = window.location.hash
        if (!hash.includes('access_token')) {
          router.push('/login')
        }
      }
    })
  }, [router, supabase])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Hasła nie są identyczne.')
      return
    }
    if (password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków.')
      return
    }

    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.updateUser({
      password: password
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // Po ustawieniu hasła przekierowujemy na stronę główną, która przekieruje do odpowiedniego panelu
      router.push('/')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <form onSubmit={handleUpdatePassword}>
          <CardHeader>
            <CardTitle className="text-2xl">Ustaw hasło</CardTitle>
            <CardDescription>
              Witaj! Ustaw hasło dla swojego konta, aby móc się logować.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Nowe hasło</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Potwierdź hasło</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Zapisywanie...' : 'Zapisz hasło i przejdź dalej'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
