import { ListEmpty } from '@/components/patterns/ListState'
import { Button } from '@/components/ui/button'

export function FeatureDisabledState({ signOut = false }: { signOut?: boolean }) {
  return (
    <ListEmpty title="Moduł niedostępny" description="Ten moduł jest niedostępny w Twojej placówce."
      action={signOut ? (
        <form action="/auth/signout" method="post">
          <Button type="submit" className="min-h-touch">Wyloguj się</Button>
        </form>
      ) : undefined} />
  )
}
