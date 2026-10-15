import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

export function RegisterLoadingCard() {
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

export function RegisterErrorCard({
  errorStatus,
  errorMessage,
  onLogin,
  onHome,
}: {
  errorStatus: string
  errorMessage: string
  onLogin: () => void
  onHome: () => void
}) {
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
          {!['EXPIRED', 'REVOKED', 'CLAIMED', 'MISSING_TOKEN'].includes(errorStatus) && 'Nieprawidłowe zaproszenie'}
        </CardTitle>
        <CardDescription className="text-sm text-text-secondary leading-relaxed">
          {errorMessage}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        <div className="rounded-lg bg-surface-sunken p-3 text-sm text-text-secondary space-y-1">
          <p className="font-semibold text-foreground">Co możesz zrobić?</p>
          <p>• Jeśli zaproszenie wygasło lub zostało odwołane, skontaktuj się z personelem placówki opiekuńczej, aby otrzymać nowy link.</p>
          <p>• Jeśli konto zostało już utworzone, przejdź do strony logowania.</p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button className="w-full" onClick={onLogin}>
          Przejdź do logowania
        </Button>
        <Button variant="outline" className="w-full" onClick={onHome}>
          Strona główna
        </Button>
      </CardFooter>
    </Card>
  )
}

export function RegisterSuccessCard({
  isGuardian,
  onLogin,
}: {
  isGuardian: boolean
  onLogin: () => void
}) {
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
        <div className="rounded-lg bg-surface-sunken p-3 text-sm text-text-secondary space-y-1">
          <p className="font-semibold text-foreground">Gotowe do użycia:</p>
          <p>• Dostęp do codziennych podsumowań i aktywności podopiecznego.</p>
          <p>• Możliwość bezpośredniego kontaktu z personelem placówki.</p>
          {isGuardian && (
            <p>• Uprawnienia do zarządzania zgodami i formalnościami opiekuńczymi.</p>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={onLogin}>
          Zaloguj się do portalu
        </Button>
      </CardFooter>
    </Card>
  )
}
