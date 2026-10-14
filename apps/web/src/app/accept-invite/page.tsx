'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Loader2, AlertCircle, HelpCircle } from 'lucide-react'
import { resolveAcceptInviteAction, type AcceptInviteResolution } from '@/lib/invite-url-helper'

function AcceptInviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlParam = searchParams.get('url')
  const tokenParam = searchParams.get('token')

  const [resolution, setResolution] = useState<AcceptInviteResolution>({ state: 'LOADING' })
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const result = resolveAcceptInviteAction(
      { url: urlParam, token: tokenParam },
      origin
    )

    setResolution(result)

    // Jeśli to token zaproszenia rodziny, automatycznie przekierowujemy do rejestracji
    if (result.state === 'REDIRECT' && result.destinationUrl) {
      router.replace(result.destinationUrl)
    }
  }, [urlParam, tokenParam, router])

  // 1. Stan: LOADING / REDIRECT
  if (resolution.state === 'LOADING' || resolution.state === 'REDIRECT') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md shadow-lg border-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">Weryfikacja zaproszenia</h3>
              <p className="text-sm text-muted-foreground">
                Sprawdzamy uprawnienia i przygotowujemy dostęp do systemu Silver Care...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 2. Stan: EMPTY (brak parametrów zaproszenia w URL)
  if (resolution.state === 'EMPTY') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md shadow-lg border-border">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto mb-3 flex justify-center">
              <Logo width={150} height={42} className="h-9 w-auto object-contain" priority />
            </div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <HelpCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold text-foreground">Brak aktywnego zaproszenia</CardTitle>
            <CardDescription className="text-sm text-muted-foreground leading-relaxed">
              Nie podano linku ani tokena zaproszenia. Upewnij się, że używasz pełnego odnośnika przesłanego w wiadomości e-mail.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Co możesz zrobić?</p>
              <p>• Otwórz wiadomość e-mail z zaproszeniem i kliknij bezpośrednio w przesłany przycisk.</p>
              <p>• Jeśli posiadasz już aktywne konto, zaloguj się podając swoje dane.</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Link href="/login" className={buttonVariants({ variant: 'default', className: 'w-full' })}>
              Przejdź do logowania
            </Link>
            <Link href="/" className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
              Strona główna
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // 3. Stan: ERROR (nieprawidłowy / niebezpieczny link)
  if (resolution.state === 'ERROR') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md shadow-lg border-destructive/20">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto mb-3 flex justify-center">
              <Logo width={150} height={42} className="h-9 w-auto object-contain" priority />
            </div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold text-foreground">Nieprawidłowe zaproszenie</CardTitle>
            <CardDescription className="text-sm text-muted-foreground leading-relaxed">
              {resolution.errorMessage || 'Link aktywacyjny jest nieprawidłowy, wygasł lub stanowi potencjalne zagrożenie bezpieczeństwa.'}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-2">
            <Link href="/login" className={buttonVariants({ variant: 'default', className: 'w-full' })}>
              Przejdź do logowania
            </Link>
            <Link href="/" className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
              Strona główna
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // 4. Stan: ACTION_READY (poprawny link aktywacyjny personelu / administratora)
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex justify-center">
            <Logo
              width={150}
              height={42}
              className="h-9 w-auto object-contain"
              priority
            />
          </div>
          <CardTitle className="text-xl font-bold text-foreground">Zaproszenie do placówki</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Zostałeś zaproszony do dołączenia do systemu Silver Care.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-sm text-muted-foreground">
            Kliknij poniższy przycisk, aby zaakceptować zaproszenie i zalogować się do swojego konta.
          </p>
          <Button
            className="w-full"
            disabled={isNavigating}
            onClick={() => {
              if (resolution.destinationUrl) {
                setIsNavigating(true)
                window.location.href = resolution.destinationUrl
              }
            }}
          >
            {isNavigating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Przekierowywanie...
              </>
            ) : (
              'Akceptuj zaproszenie'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  )
}
