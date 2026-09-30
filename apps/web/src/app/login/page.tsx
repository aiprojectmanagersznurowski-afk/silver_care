'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'

/**
 * @REQ: UI-ACCESSIBILITY
 * @REQ: UI-FOUR-STATES
 * @REQ: SEC-SESSION
 *
 * Odświeżona strona logowania Silver Care zoptymalizowana pod kątem WCAG AA,
 * estetyki 21st.dev (canvas z cząsteczkami, linie akcentowe, płynne animacje)
 * oraz tożsamości wizualnej Silver Care (Ciepłe Zaufanie, zieleń szałwiowa).
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

  // Animacja cząsteczek z 21st.dev dopasowana do palety Silver Care
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const setSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    setSize()

    type Particle = { x: number; y: number; v: number; o: number }
    let particles: Particle[] = []
    let animationFrameId = 0

    const makeParticle = (): Particle => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      v: Math.random() * 0.25 + 0.05,
      o: Math.random() * 0.35 + 0.15,
    })

    const init = () => {
      particles = []
      const count = Math.floor((canvas.width * canvas.height) / 10000)
      for (let i = 0; i < count; i++) particles.push(makeParticle())
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach((p) => {
        p.y -= p.v
        if (p.y < 0) {
          p.x = Math.random() * canvas.width
          p.y = canvas.height + Math.random() * 40
          p.v = Math.random() * 0.25 + 0.05
          p.o = Math.random() * 0.35 + 0.15
        }
        // Subtelna szałwiowa poświata cząsteczek
        ctx.fillStyle = `rgba(47, 111, 94, ${p.o * 0.45})`
        ctx.fillRect(p.x, p.y, 1.2, 2.4)
      })
      animationFrameId = requestAnimationFrame(draw)
    }

    const onResize = () => {
      setSize()
      init()
    }

    window.addEventListener('resize', onResize)
    init()
    animationFrameId = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsRevealed(true)
    }, 400)

    // 1. Obsługa błędu z parametrów zapytania URL (?error=...)
    const searchParams = new URLSearchParams(window.location.search)
    const queryError = searchParams.get('error')
    if (queryError) {
      setError(queryError)
      window.history.replaceState(null, '', window.location.pathname)
    }

    // 2. Obsługa hasha z zaproszenia lub tokenu resetu hasła (#access_token=... lub #error=...)
    const hash = window.location.hash
    if (hash.includes('access_token')) {
      router.push(`/update-password${hash}`)
    } else if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.replace('#', '?'))
      const errorDescription = params.get('error_description')
      if (errorDescription) {
        setError(errorDescription.replace(/\+/g, ' '))
      } else {
        setError('Wystąpił błąd autoryzacji.')
      }
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
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: password.trim(),
    })

    if (signInError) {
      setError('Nieprawidłowy email lub hasło.')
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <div 
      className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground overflow-hidden select-none"
      onClick={() => { if (!isRevealed) setIsRevealed(true) }}
    >
      <style>{`
        .accent-lines {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.4;
        }
        .hline, .vline {
          position: absolute;
          background: var(--color-border);
          will-change: transform, opacity;
        }
        .hline {
          left: 0;
          right: 0;
          height: 1px;
          transform: scaleX(0);
          transform-origin: 50% 50%;
          animation: drawX .8s cubic-bezier(.22,.61,.36,1) forwards;
        }
        .vline {
          top: 0;
          bottom: 0;
          width: 1px;
          transform: scaleY(0);
          transform-origin: 50% 0%;
          animation: drawY .9s cubic-bezier(.22,.61,.36,1) forwards;
        }
        .hline:nth-child(1) { top: 18%; animation-delay: .12s; }
        .hline:nth-child(2) { top: 50%; animation-delay: .22s; }
        .hline:nth-child(3) { top: 82%; animation-delay: .32s; }
        .vline:nth-child(4) { left: 22%; animation-delay: .42s; }
        .vline:nth-child(5) { left: 50%; animation-delay: .54s; }
        .vline:nth-child(6) { left: 78%; animation-delay: .66s; }
        
        .hline::after, .vline::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(47, 111, 94, 0.2), transparent);
          opacity: 0;
          animation: shimmer .9s ease-out forwards;
        }
        .hline:nth-child(1)::after { animation-delay: .12s; }
        .hline:nth-child(2)::after { animation-delay: .22s; }
        .hline:nth-child(3)::after { animation-delay: .32s; }
        .vline:nth-child(4)::after { animation-delay: .42s; }
        .vline:nth-child(5)::after { animation-delay: .54s; }
        .vline:nth-child(6)::after { animation-delay: .66s; }

        @keyframes drawX {
          0% { transform: scaleX(0); opacity: 0; }
          60% { opacity: .95; }
          100% { transform: scaleX(1); opacity: .7; }
        }
        @keyframes drawY {
          0% { transform: scaleY(0); opacity: 0; }
          60% { opacity: .95; }
          100% { transform: scaleY(1); opacity: .7; }
        }
        @keyframes shimmer {
          0% { opacity: 0; }
          35% { opacity: .25; }
          100% { opacity: 0; }
        }

        .card-animate {
          opacity: 0;
          transform: translateY(16px);
          animation: fadeUp 0.7s cubic-bezier(.22,.61,.36,1) 0.2s forwards;
        }
        @keyframes fadeUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Subtelna winieta i tło świetlne zgodne z paletą Silver Care */}
      <div className="absolute inset-0 pointer-events-none [background:radial-gradient(75%_55%_at_50%_35%,rgba(47,111,94,0.06),transparent_70%)]" />

      {/* Animowane linie akcentowe */}
      <div className="accent-lines">
        <div className="hline" />
        <div className="hline" />
        <div className="hline" />
        <div className="vline" />
        <div className="vline" />
        <div className="vline" />
      </div>

      {/* Cząsteczki w tle */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-60 pointer-events-none"
      />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* Wizualizacja Logo Silver Care */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <div className="absolute -inset-4 rounded-full bg-primary/10 blur-xl opacity-60" />
            <Image
              src="/logo.png"
              alt="Silver Care"
              width={200}
              height={55}
              className="relative h-12 w-auto object-contain drop-shadow-sm transition-transform duration-700"
              priority
            />
          </div>
          <p className="mt-2 text-xs tracking-wider uppercase text-muted-foreground font-medium">
            Portal codziennego życia placówki
          </p>
        </div>

        {/* Panel logowania */}
        <Card className="card-animate w-full border-border/80 bg-card/95 shadow-lg backdrop-blur-md">
          <form onSubmit={handleLogin}>
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-semibold tracking-tight text-foreground font-display">
                Zaloguj się
              </CardTitle>
              <CardDescription className="text-muted-foreground text-sm mt-1">
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
                <Label htmlFor="email" className="text-foreground font-medium text-xs">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="m.kowalski@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 rounded-lg border-input bg-background/50 focus-visible:ring-primary"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-medium text-xs">
                  Hasło
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9 rounded-lg border-input bg-background/50 focus-visible:ring-primary"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(!!checked)}
                  />
                  <Label htmlFor="remember" className="text-xs text-muted-foreground cursor-pointer">
                    Zapamiętaj mnie
                  </Label>
                </div>
                <span className="text-xs text-primary hover:underline cursor-pointer">
                  Pomoc
                </span>
              </div>
            </CardContent>

            <CardFooter className="flex-col gap-3.5 pt-2">
              <Button
                type="submit"
                className="w-full h-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm transition-all"
                disabled={loading}
              >
                {loading ? 'Logowanie...' : 'Zaloguj się'}
              </Button>

              <div className="relative w-full my-1">
                <Separator />
                <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-card px-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  Albo
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-10 rounded-lg border-border hover:bg-muted text-foreground font-medium transition-colors"
                disabled={loading}
                onClick={async () => {
                  try {
                    setLoading(true)
                    setError(null)
                    const supabase = createClient()
                    const { error: oauthError } = await supabase.auth.signInWithOAuth({
                      provider: 'google',
                      options: {
                        redirectTo: `${window.location.origin}/auth/callback`,
                      },
                    })
                    if (oauthError) {
                      setError(oauthError.message)
                      setLoading(false)
                    }
                  } catch (err: any) {
                    setError(err?.message || 'Nie udało się połączyć z usługą Google.')
                    setLoading(false)
                  }
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
