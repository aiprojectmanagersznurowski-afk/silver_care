import type { ReactNode } from 'react'

import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ResidentProfileTabsProps {
  /** Przegląd: dane ogólne i łóżko. */
  overview: ReactNode
  /** Pasek boczny przeglądu (umowa i pakiety). */
  sidebar: ReactNode
  family: ReactNode
  events: ReactNode
  wearable: ReactNode
}

/**
 * Zakładki profilu podopiecznego w układzie profilu szablonu shadcn-admin:
 * linia zakładek, w przeglądzie treść główna, separator i pasek boczny 18rem.
 */
export function ResidentProfileTabs({ overview, sidebar, family, events, wearable }: ResidentProfileTabsProps) {
  return (
    <Tabs defaultValue="overview" className="gap-0">
      <div className="overflow-x-auto border-y border-border">
        <TabsList variant="line" className="w-max min-w-full justify-start gap-4">
          <TabsTrigger value="overview">Przegląd</TabsTrigger>
          <TabsTrigger value="family">Bliscy i kontakty</TabsTrigger>
          <TabsTrigger value="events">Zdarzenia</TabsTrigger>
          <TabsTrigger value="wearable">Opaska</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_auto_18rem]">
          <div className="space-y-6 py-4 lg:pr-6">{overview}</div>
          <Separator className="hidden lg:block" orientation="vertical" />
          <aside data-slot="profile-sidebar" className="py-4 lg:pl-6">{sidebar}</aside>
        </div>
      </TabsContent>
      <TabsContent value="family" className="py-4">{family}</TabsContent>
      <TabsContent value="events" className="py-4">{events}</TabsContent>
      <TabsContent value="wearable" className="py-4">{wearable}</TabsContent>
    </Tabs>
  )
}
