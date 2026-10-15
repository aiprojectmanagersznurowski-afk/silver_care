'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useLoginParticles } from '@/components/auth/use-login-particles'
import { LoginBackgroundStyles } from '@/components/auth/LoginBackgroundStyles'

/**
 * @REQ: UI-ACCESSIBILITY @REQ: UI-FOUR-STATES @REQ: SEC-SESSION
 */
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isRevealed, setIsRevealed] = useState(false)
  const router = useRouter()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useLoginParticles(canvasRef)

  useEffect(() => {
    const timer = setTimeout(() => setIsRevealed(true), 400)
    void Promise.resolve().then(() => {
      const searchParams = new URLSearchParams(window.location.search)
      const queryError = searchParams.get('error')
      if (queryError) {
        setError(queryError)
        window.history.replaceState(null, '', window.location.pathname)
      }
      const hash = window.location.hash
      if (hash.includes('access_token')) {
        router.push(`/update-password${hash}`)
      } else if (hash.includes('error=')) {
        const params = new URLSearchParams(hash.replace('#', '?'))
        const desc = params.get('error_description')
        setError(desc ? desc.replace(/\+/g, ' ') : 'Wystąpił błąd autoryzacji.')
        window.history.replaceState(null, '', window.location.pathname)
      }
    })
    return () => clearTimeout(timer)
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password.trim(),
    })
    if (signInError) {
      setError('Nieprawidłowy email lub hasło.')
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (oauthError) {
        setError(oauthError.message)
        setLoading(false)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nie udało się połączyć z usługą Google.')
      setLoading(false)
    }
  }

  return (
    <main 
      className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground overflow-hidden select-none"
      onClick={() => { if (!isRevealed) setIsRevealed(true) }}
    >
      <LoginBackgroundStyles />
      <div className="accent-lines">
        <div className="hline" /><div className="hline" /><div className="hline" />
        <div className="vline" /><div className="vline" /><div className="vline" />
      </div>

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <div className="absolute -inset-4 rounded-full bg-primary/10 blur-xl opacity-60" />
            <Logo alt="Silver Care" width={200} height={55} className="relative h-12 w-auto object-contain transition-transform duration-700" priority />
          </div>
          <p className="mt-2 text-sm tracking-wider uppercase text-muted-foreground font-medium">
            Portal codziennego życia placówki
          </p>
        </div>

        <Card className="card-animate w-full border-border/80 bg-card/95 shadow-lg backdrop-blur-md">
          <form onSubmit={handleLogin}>
            <CardHeader className="text-center pb-4">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground font-display">
                Zaloguj się
              </h1>
              <CardDescription className="text-muted-foreground text-sm mt-1">
                Wprowadź swoje dane, aby uzyskać dostęp do panelu.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pb-6">
              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium text-sm">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    placeholder="np. jan@placowka.pl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-11 md:h-10 rounded-lg border-input bg-background/50 focus-visible:ring-primary text-base md:text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-medium text-sm">Hasło</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-11 h-11 md:h-10 rounded-lg border-input bg-background/50 focus-visible:ring-primary text-base md:text-sm"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1.5">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(!!checked)}
                  />
                  <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer select-none">
                    Zapamiętaj mnie
                  </Label>
                </div>
                <a
                  href="mailto:pomoc@silvercare.space?subject=Nie%20pami%C4%99tam%20has%C5%82a%20-%20Silver%20Care"
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Nie pamiętasz hasła?
                </a>
              </div>
            </CardContent>

            <CardFooter className="flex-col gap-3.5 p-6 pt-5">
              <Button
                type="submit"
                className="w-full h-11 md:h-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all"
                disabled={loading}
              >
                {loading ? 'Logowanie...' : 'Zaloguj się'}
              </Button>

              <div className="relative w-full my-1">
                <Separator />
                <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-card px-2 text-sm uppercase tracking-wider text-muted-foreground font-medium">
                  Albo
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 md:h-10 rounded-lg border-border hover:bg-muted text-foreground font-medium transition-colors inline-flex items-center justify-center gap-2"
                disabled={loading}
                onClick={handleGoogleLogin}
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                  <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                </svg>
                <span>Zaloguj z Google</span>
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  )
}
