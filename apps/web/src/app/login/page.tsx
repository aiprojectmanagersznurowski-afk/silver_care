'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isRevealed, setIsRevealed] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Efekt wizualizacji: logo pojawia się jako główny element strony,
    // a po chwili płynnie wyłania się panel logowania
    const timer = setTimeout(() => {
      setIsRevealed(true)
    }, 1100)

    // Jeśli użytkownik trafia tutaj po kliknięciu w link zaproszenia, w hashu URL znajduje się token
    const hash = window.location.hash
    if (hash.includes('access_token')) {
      router.push(`/update-password${hash}`)
    } else if (hash.includes('error=access_denied')) {
      const params = new URLSearchParams(hash.replace('#', '?'))
      const errorDescription = params.get('error_description')
      if (errorDescription) {
        setError(errorDescription.replace(/\+/g, ' '))
      } else {
        setError('Link wygasł lub jest nieprawidłowy.')
      }
      // Oczyść hash
      window.history.replaceState(null, '', window.location.pathname)
    }

    return () => clearTimeout(timer)
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const normalizedEmail = email.trim().toLowerCase()
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: password.trim(),
    })

    if (error) {
      setError('Nieprawidłowy email lub hasło.')
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <div 
      className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background via-cream-deep to-secondary overflow-hidden select-none"
      onClick={() => { if (!isRevealed) setIsRevealed(true) }}
    >
      {/* Subtelne tło dekoracyjne i miękka poświata */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-accent/60 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* Wizualizacja głównego Logo: wyśrodkowane i powiększone w fazie wstępnej, następnie płynnie przechodzące nad kartę */}
        <div 
          className={`flex flex-col items-center transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isRevealed 
              ? 'translate-y-0 scale-100 mb-6' 
              : 'translate-y-[190px] sm:translate-y-[200px] scale-125 sm:scale-135'
          }`}
        >
          <div className="relative">
            {/* Delikatna poświata akcentowa */}
            <div 
              className={`absolute -inset-6 rounded-full bg-primary/15 blur-2xl transition-opacity duration-1000 ${
                isRevealed ? 'opacity-30' : 'opacity-80 animate-pulse'
              }`} 
            />
            
            <Image
              src="/logo.png"
              alt="Silver Care"
              width={220}
              height={60}
              className="relative h-12 sm:h-14 w-auto object-contain drop-shadow-sm transition-transform duration-1000"
              priority
            />
          </div>

          {/* Dyskretny podpis podczas początkowej ekspozycji logo */}
          <p 
            className={`mt-3 text-xs tracking-wider uppercase text-slate-soft font-medium transition-all duration-700 ease-out ${
              isRevealed 
                ? 'opacity-0 max-h-0 -translate-y-2 pointer-events-none' 
                : 'opacity-100 max-h-8 translate-y-0'
            }`}
          >
            Portal codziennej opieki
          </p>
        </div>

        {/* Panel logowania wyłaniający się płynnie pod logo */}
        <Card 
          className={`w-full shadow-xl border-slate/10 bg-card/95 backdrop-blur-md transition-all duration-800 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isRevealed 
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' 
              : 'opacity-0 translate-y-10 scale-95 pointer-events-none'
          }`}
        >
          <form onSubmit={handleLogin}>
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-semibold tracking-tight text-slate">Zaloguj się</CardTitle>
              <CardDescription className="text-slate-soft text-sm mt-1">
                Wprowadź swoje dane, aby uzyskać dostęp do panelu.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate font-medium text-xs">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m.kowalski@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl border-slate/15 bg-card focus-visible:ring-sage"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate font-medium text-xs">Hasło</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl border-slate/15 bg-card focus-visible:ring-sage"
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-4 pt-2">
              <Button type="submit" className="w-full rounded-xl bg-sage hover:bg-sage-dark text-white font-medium shadow-sm transition-all" disabled={loading}>
                {loading ? 'Logowanie...' : 'Zaloguj się'}
              </Button>
              
              <div className="relative w-full my-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-slate-soft text-[11px] font-medium tracking-wide">
                    Albo
                  </span>
                </div>
              </div>

              <Button 
                type="button" 
                variant="outline" 
                className="w-full rounded-xl border-slate/15 hover:bg-slate/5 text-slate font-medium transition-colors" 
                disabled={loading}
                onClick={async () => {
                  setLoading(true)
                  const supabase = createClient()
                  await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: `${window.location.origin}/auth/callback`
                    }
                  })
                }}
              >
                Zaloguj z Google
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}

