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
  target_date: string | null
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
  
  // Date viewing state
  const [viewDate, setViewDate] = useState(new Date().toISOString().slice(0, 10))

  // Form state
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [type, setType] = useState('other')
  const [isRecurring, setIsRecurring] = useState(true)
  const [itemDates, setItemDates] = useState<string[]>([new Date().toISOString().slice(0, 10)])
  const [currentDateInput, setCurrentDateInput] = useState(new Date().toISOString().slice(0, 10))
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = async () => {
    setLoading(true)
    const res = await fetch(`/api/staff/agenda?date=${viewDate}`)
    const data = await res.json()
    setItems(data.items || [])
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [viewDate])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !time || !type) return
    if (!isRecurring && itemDates.length === 0) return
    
    setSubmitting(true)
    await fetch('/api/staff/agenda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        title, 
        time, 
        type, 
        target_dates: isRecurring ? [] : itemDates 
      }),
    })
    setTitle('')
    setTime('')
    setType('other')
    setItemDates([new Date().toISOString().slice(0, 10)])
    setSubmitting(false)
    fetchItems()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/staff/agenda?id=${id}`, { method: 'DELETE' })
    fetchItems()
  }

  const addDate = () => {
    if (currentDateInput && !itemDates.includes(currentDateInput)) {
      setItemDates([...itemDates, currentDateInput].sort())
    }
  }

  const removeDate = (dateToRemove: string) => {
    setItemDates(itemDates.filter(d => d !== dateToRemove))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Plan Dnia</h2>
        <p className="text-text-secondary">Zarządzaj harmonogramem placówki. Cykliczne wpisy pokazują się każdego dnia.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agenda View */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <CardTitle>Harmonogram</CardTitle>
                  <CardDescription>
                    {new Date(viewDate).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input 
                    type="date" 
                    value={viewDate} 
                    onChange={e => setViewDate(e.target.value)}
                    className="w-auto h-9"
                  />
                  <Button variant="outline" size="sm" onClick={() => setViewDate(new Date().toISOString().slice(0, 10))}>
                    Dziś
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-text-secondary">Ładowanie...</p>
              ) : items.length === 0 ? (
                <p className="text-sm text-text-secondary py-4 text-center">Brak wpisów na ten dzień.</p>
              ) : (
                <div className="space-y-3">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-14 text-sm font-semibold text-text-secondary">{item.time.slice(0, 5)}</div>
                        <div>
                          <div className="text-sm font-medium">
                            {item.title} 
                            {!item.target_date && <span className="ml-2 text-[10px] font-normal uppercase bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Codziennie</span>}
                          </div>
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
                
                <div className="pt-2 pb-1 border-t mt-2">
                  <Label className="mb-2 block">Częstotliwość</Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="recurring" checked={isRecurring} onChange={() => setIsRecurring(true)} className="h-4 w-4" />
                      <span className="text-sm">Codziennie (wszystkie dni)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="recurring" checked={!isRecurring} onChange={() => setIsRecurring(false)} className="h-4 w-4" />
                      <span className="text-sm">Wybrane dni</span>
                    </label>
                  </div>
                </div>

                {!isRecurring && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-1 bg-muted/50 p-3 rounded-md border border-border">
                    <div className="space-y-1">
                      <Label htmlFor="agenda-date">Wybierz daty</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="agenda-date" 
                          type="date" 
                          value={currentDateInput} 
                          onChange={e => setCurrentDateInput(e.target.value)} 
                          className="flex-1"
                        />
                        <Button type="button" variant="secondary" onClick={addDate}>Dodaj</Button>
                      </div>
                    </div>
                    {itemDates.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {itemDates.map(d => (
                          <span key={d} className="inline-flex items-center gap-1 bg-background border border-border text-xs px-2 py-1 rounded">
                            {new Date(d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                            <button type="button" onClick={() => removeDate(d)} className="text-muted-foreground hover:text-foreground">
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-destructive">Wybierz co najmniej jedną datę.</p>
                    )}
                  </div>
                )}

                <Button type="submit" className="w-full mt-2" disabled={submitting || (!isRecurring && itemDates.length === 0)}>
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
