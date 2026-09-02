import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'

export default function AcceptInvitePage({ searchParams }: { searchParams: { url?: string } }) {
  if (!searchParams.url) {
    redirect('/')
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Zaproszenie do placówki</CardTitle>
          <CardDescription>
            Zostałeś zaproszony do dołączenia do systemu Silver Care.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-sm text-muted-foreground">
            Kliknij poniższy przycisk, aby zaakceptować zaproszenie i zalogować się do swojego konta.
          </p>
          <a href={searchParams.url} className={buttonVariants({ className: "w-full" })}>
            Akceptuj zaproszenie
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
