import Link from 'next/link'
import { CalendarDays, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { ListEmpty } from '@/components/patterns/ListState'
import { StatusBadge } from '@/components/patterns/StatusBadge'

type Row = Record<string, unknown>

const REPORT_STATUS: Record<string, string> = { draft: 'Roboczy', published: 'Opublikowany' }

const day = (value: unknown) => (typeof value === 'string' ? value.slice(0, 10).split('-').reverse().join('.') : '—')

interface DailySectionProps {
  reports: Row[]
  agenda: Row[]
  /** Pełna lista raportów w części aplikacji właściwej dla roli. */
  reportsHref: string
}

/** Raporty i plan dnia podopiecznego: ostatnie wpisy jako fakty (data, status, godzina, tytuł). */
export function DailySection({ reports, agenda, reportsHref }: DailySectionProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Ostatnie raporty</CardTitle>
          <Link href={reportsHref} className={buttonVariants({ variant: 'outline' })}>
            Wszystkie raporty
          </Link>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <ListEmpty icon={<FileText />} title="Brak raportów" description="Nie ma jeszcze raportów dla tego podopiecznego." />
          ) : (
            <ul className="divide-y divide-border">
              {reports.map((r) => (
                <li key={String(r.id)} className="flex min-h-touch items-center justify-between gap-3 text-sm">
                  <span>Raport z dnia {day(r.created_at)}</span>
                  <StatusBadge tone={String(r.status).toLowerCase() === 'published' ? 'brand' : 'neutral'}>
                    {REPORT_STATUS[String(r.status).toLowerCase()] ?? String(r.status)}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan dnia</CardTitle>
        </CardHeader>
        <CardContent>
          {agenda.length === 0 ? (
            <ListEmpty icon={<CalendarDays />} title="Brak zadań w planie dnia" description="Nie zaplanowano zadań dla tego podopiecznego." />
          ) : (
            <ul className="divide-y divide-border">
              {agenda.map((a) => (
                <li key={String(a.id)} className="flex min-h-touch items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-muted-foreground">{day(a.target_date)} {String(a.time ?? '').slice(0, 5)}</span>
                  <span className="text-foreground">{String(a.title)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
