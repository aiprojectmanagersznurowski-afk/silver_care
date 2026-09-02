'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AcceptInvitePage({ searchParams }: { searchParams: { url?: string } }) {
  const router = useRouter()

  useEffect(() => {
    if (!searchParams.url) {
      router.push('/')
    }
  }, [searchParams.url, router])

  if (!searchParams.url) return null
  
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
          <Button 
            className="w-full" 
            onClick={() => {
              window.location.href = searchParams.url as string
            }}
          >
            Akceptuj zaproszenie
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
