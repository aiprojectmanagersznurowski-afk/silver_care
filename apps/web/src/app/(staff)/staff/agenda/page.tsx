'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AgendaItem {
  id: string
  title: string
  time: string
  type: string
  resident_id: string | null
  is_template: boolean
}

const ITEM_TYPES = [
  { value: 'meal', label: 'Posiłek' },
  { value: 'therapy', label: 'Terapia / Rehabilitacja' },
  { value: 'hygiene', label: 'Higiena' },
  { value: 'activity', label: 'Aktywność grupowa' },
  { value: 'rest', label: 'Odpoczynek' },
  { value: 'other', label: 'Inne' },
]

export default function StaffAgendaPage() {
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [type, setType] = useState('other')
  const [isTemplate, setIsTemplate] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = async () => {
    const res = await fetch('/api/staff/agenda')
    const data = await res.json()
    setItems(data.items || [])
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !time || !type) return
    setSubmitting(true)
    await fetch('/api/staff/agenda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, time, type, is_template: isTemplate }),
    })
    setTitle('')
    setTime('')
    setType('other')
    setIsTemplate(false)
    setSubmitting(false)
    fetchItems()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/staff/agenda?id=${id}`, { method: 'DELETE' })
    fetchItems()
  }

  const applyTemplate = async () => {
    const templates = items.filter(i => i.is_template)
    for (const t of templates) {
      await fetch('/api/staff/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t.title, time: t.time, type: t.type, is_template: false }),
      })
    }
    fetchItems()
  }

  const todayItems = items.filter(i => !i.is_template)
  const templateItems = items.filter(i => i.is_template)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Plan Dnia</h2>
        <p className="text-text-secondary">Zarządzaj harmonogramem placówki. Wpisy bez przypisanego pensjonariusza dotyczą wszystkich.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's agenda */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Dzisiejszy harmonogram</CardTitle>
                  <CardDescription>{new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}</CardDescription>
                </div>
                {templateItems.length > 0 && (
                  <Button variant="outline" size="sm" onClick={applyTemplate}>
                    Zastosuj szablon ({templateItems.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-text-secondary">Ładowanie...</p>
              ) : todayItems.length === 0 ? (
                <p className="text-sm text-text-secondary py-4 text-center">Brak wpisów na dziś. Dodaj nowy lub zastosuj szablon.</p>
              ) : (
                <div className="space-y-3">
                  {todayItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-14 text-sm font-semibold text-text-secondary">{item.time.slice(0, 5)}</div>
                        <div>
                          <div className="text-sm font-medium">{item.title}</div>
                          <div className="text-xs text-text-tertiary">
                            {ITEM_TYPES.find(t => t.value === item.type)?.label || item.type}
                            {!item.resident_id && ' · Wszyscy'}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => handleDelete(item.id)} className="text-xs text-destructive hover:underline">Usuń</button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Add new item */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nowy wpis</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="agenda-title">Tytuł</Label>
                  <Input id="agenda-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Np. Śniadanie" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="agenda-time">Godzina</Label>
                  <Input id="agenda-time" type="time" value={time} onChange={e => setTime(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="agenda-type">Typ</Label>
                  <select id="agenda-type" value={type} onChange={e => setType(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isTemplate} onChange={e => setIsTemplate(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                  <span className="text-sm">Zapisz jako szablon (do ponownego użycia)</span>
                </label>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Dodawanie...' : 'Dodaj wpis'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
