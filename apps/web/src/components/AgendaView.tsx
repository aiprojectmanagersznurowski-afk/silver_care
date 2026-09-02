'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface AgendaItem {
  id: string
  title: string
  time: string
  type: string
  resident_id: string | null
  is_template: boolean
}

interface AgendaViewProps {
  residents: Record<string, unknown>[]
}

export function AgendaView({ residents }: AgendaViewProps) {
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/staff/agenda')
      .then(res => res.json())
      .then(data => {
        if (data.items) {
          setItems(data.items)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-sm text-text-secondary py-4">Ładowanie harmonogramu agendy...</div>
  }

  return (
    <Card className="mb-6 shadow-sm border-primary/20">
      <CardHeader className="bg-primary/5 rounded-t-xl pb-4">
        <CardTitle className="text-xl">Agenda na dziś</CardTitle>
        <CardDescription>Bieżący harmonogram rutyn i zabiegów</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {items.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-4">Brak zaplanowanych wpisów w agendzie na dzisiaj.</p>
        ) : (
          <ul className="space-y-3">
            {items.map(item => {
              const resident = item.resident_id 
                ? residents.find(r => r.id === item.resident_id)
                : null
                
              return (
                <li key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-sunken border border-border">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary">{item.time.substring(0,5)}</span>
                      <span className="font-medium text-foreground">{item.title}</span>
                    </div>
                    {resident ? (
                      <div className="text-xs text-text-tertiary mt-1 font-medium">
                        Pensjonariusz: {resident.first_name as string} {resident.last_name as string}
                      </div>
                    ) : (
                      <div className="text-xs text-text-tertiary mt-1">
                        Zadanie wspólne
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-primary/10 text-primary rounded-full uppercase tracking-wider">
                    {item.type}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
