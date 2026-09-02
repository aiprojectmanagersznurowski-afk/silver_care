'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

function AcceptInviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const url = searchParams.get('url')

  useEffect(() => {
    if (!url) {
      router.push('/')
    }
  }, [url, router])

  if (!url) return null
  
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
              window.location.href = url as string
            }}
          >
            Akceptuj zaproszenie
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <AcceptInviteContent />
    </Suspense>
  )
}
