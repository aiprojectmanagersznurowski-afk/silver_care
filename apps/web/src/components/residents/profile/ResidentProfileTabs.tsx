import type { ReactNode } from 'react'

import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export interface ProfileTab {
  id: string
  label: string
  content: ReactNode
}

interface ResidentProfileTabsProps {
  /** Etykieta zakładki przeglądu (z kontraktu). */
  overviewLabel: string
  /** Przegląd: dane ogólne i łóżko. */
  overview: ReactNode
  /** Pasek boczny przeglądu (umowa i pakiety) — tylko dla ról z tą sekcją. */
  sidebar?: ReactNode
  /** Pozostałe zakładki w kolejności sekcji kontraktu; rola widzi tylko swoje. */
  tabs: ProfileTab[]
}

/**
 * Zakładki karty podopiecznego w układzie profilu szablonu shadcn-admin: linia zakładek, w przeglądzie
 * treść główna i (jeśli rola ma do niego dostęp) pasek boczny 18rem.
 */
export function ResidentProfileTabs({ overviewLabel, overview, sidebar, tabs }: ResidentProfileTabsProps) {
  return (
    <Tabs defaultValue="overview" className="gap-0">
      {/* Bez kontenera z przewijaniem: podkreślenie aktywnej zakładki wystaje pod listę i dawało pasek przewijania.
          Zakładki zawijają się do kolejnego wiersza, gdy nie mieszczą się w szerokości. */}
      <div className="border-y border-border py-1">
        <TabsList variant="line" className="w-full flex-wrap justify-start gap-x-4 gap-y-1 group-data-horizontal/tabs:h-auto">
          <TabsTrigger value="overview" className="h-8 flex-none">{overviewLabel}</TabsTrigger>
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="h-8 flex-none">{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="overview">
        {sidebar ? (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_auto_18rem]">
            <div className="space-y-6 py-4 lg:pr-6">{overview}</div>
            <Separator className="hidden lg:block" orientation="vertical" />
            <aside data-slot="profile-sidebar" className="py-4 lg:pl-6">{sidebar}</aside>
          </div>
        ) : (
          <div className="space-y-6 py-4">{overview}</div>
        )}
      </TabsContent>
      {tabs.map((t) => (
        <TabsContent key={t.id} value={t.id} className="py-4">{t.content}</TabsContent>
      ))}
    </Tabs>
  )
}
