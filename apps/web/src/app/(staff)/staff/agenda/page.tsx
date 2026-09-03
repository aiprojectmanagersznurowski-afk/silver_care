'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarX, X, Trash2, Calendar as CalendarIcon, Clock, Plus } from 'lucide-react'

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
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-semibold tracking-tight text-slate">Plan Dnia</h2>
        <p className="mt-2 text-slate-soft">Zarządzaj harmonogramem placówki. Cykliczne wpisy pokazują się każdego dnia.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Agenda View */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate/5 bg-white overflow-hidden">
            <div className="p-6 border-b border-slate/5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate/5">
              <div>
                <h3 className="text-lg font-semibold text-slate flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-sage-dark" />
                  Harmonogram
                </h3>
                <p className="text-sm font-medium text-slate-soft mt-1">
                  {new Date(viewDate).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="date" 
                  value={viewDate} 
                  onChange={e => setViewDate(e.target.value)}
                  className="rounded-xl border border-slate/10 bg-white px-3 py-2 text-sm text-slate shadow-sm focus:outline-none focus:ring-2 focus:ring-sage"
                />
                <button 
                  onClick={() => setViewDate(new Date().toISOString().slice(0, 10))}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate shadow-sm ring-1 ring-inset ring-slate/10 hover:bg-slate/5 transition-colors"
                >
                  Dziś
                </button>
              </div>
            </div>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center text-sm font-medium text-slate-soft">Ładowanie harmonogramu...</div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate/5 text-slate-soft mb-4">
                    <CalendarX className="h-8 w-8" />
                  </div>
                  <p className="text-base font-medium text-slate">Brak wpisów na ten dzień.</p>
                  <p className="text-sm mt-2 text-slate-soft text-center max-w-sm">Zarządzaj harmonogramem dodając nowe wpisy z panelu po prawej stronie.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate/5">
                  {items.map(item => (
                    <div key={item.id} className="group flex items-center justify-between p-6 transition-colors hover:bg-slate/5">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center justify-center rounded-xl bg-sage/10 w-16 h-16 shrink-0">
                          <span className="text-lg font-bold text-sage-dark">{item.time.slice(0, 5)}</span>
                        </div>
                        <div className="py-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-semibold text-slate">{item.title}</h4>
                            {!item.target_date && (
                              <span className="inline-flex items-center rounded-md bg-slate/10 px-2 py-0.5 text-xs font-medium text-slate-soft uppercase tracking-wider">
                                Codziennie
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-medium text-slate-soft mt-1">
                            {ITEM_TYPES.find(t => t.value === item.type)?.label || item.type}
                            {!item.resident_id && ' · Ogólnoplacówkowe'}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDelete(item.id)} 
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-soft opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600"
                        title="Usuń wpis"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Add new item */}
        <div className="space-y-6">
          <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate/5 bg-white">
            <div className="p-6 border-b border-slate/5">
              <h3 className="text-lg font-semibold text-slate flex items-center gap-2">
                <Plus className="h-5 w-5 text-sage-dark" />
                Nowy wpis
              </h3>
            </div>
            <CardContent className="p-6">
              <form onSubmit={handleAdd} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="agenda-title" className="text-sm font-medium text-slate">Tytuł</label>
                  <input 
                    id="agenda-title" 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    placeholder="Np. Śniadanie" 
                    required 
                    className="w-full rounded-xl border border-slate/20 bg-white px-4 py-2.5 text-sm text-slate shadow-sm focus:outline-none focus:ring-2 focus:ring-sage"
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="agenda-time" className="text-sm font-medium text-slate flex items-center gap-1">
                    <Clock className="h-4 w-4 text-slate-soft" /> Godzina
                  </label>
                  <input 
                    id="agenda-time" 
                    type="time" 
                    value={time} 
                    onChange={e => setTime(e.target.value)} 
                    required 
                    className="w-full rounded-xl border border-slate/20 bg-white px-4 py-2.5 text-sm text-slate shadow-sm focus:outline-none focus:ring-2 focus:ring-sage"
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="agenda-type" className="text-sm font-medium text-slate">Typ wydarzenia</label>
                  <select 
                    id="agenda-type" 
                    value={type} 
                    onChange={e => setType(e.target.value)} 
                    className="w-full rounded-xl border border-slate/20 bg-white px-4 py-2.5 text-sm text-slate shadow-sm focus:outline-none focus:ring-2 focus:ring-sage"
                  >
                    {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                
                <div className="pt-4 border-t border-slate/10 mt-6">
                  <label className="text-sm font-medium text-slate mb-3 block">Częstotliwość</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex flex-col items-center justify-center rounded-xl p-4 cursor-pointer transition-all ${isRecurring ? 'bg-sage/10 ring-2 ring-sage-dark' : 'bg-slate/5 hover:bg-slate/10 ring-1 ring-slate/10'}`}>
                      <input type="radio" name="recurring" checked={isRecurring} onChange={() => setIsRecurring(true)} className="sr-only" />
                      <span className={`text-sm font-semibold ${isRecurring ? 'text-sage-dark' : 'text-slate'}`}>Codziennie</span>
                      <span className="text-xs text-slate-soft mt-1">Wszystkie dni</span>
                    </label>
                    <label className={`flex flex-col items-center justify-center rounded-xl p-4 cursor-pointer transition-all ${!isRecurring ? 'bg-sage/10 ring-2 ring-sage-dark' : 'bg-slate/5 hover:bg-slate/10 ring-1 ring-slate/10'}`}>
                      <input type="radio" name="recurring" checked={!isRecurring} onChange={() => setIsRecurring(false)} className="sr-only" />
                      <span className={`text-sm font-semibold ${!isRecurring ? 'text-sage-dark' : 'text-slate'}`}>Jednorazowo</span>
                      <span className="text-xs text-slate-soft mt-1">Wybrane daty</span>
                    </label>
                  </div>
                </div>

                {!isRecurring && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-1 bg-slate/5 p-4 rounded-2xl ring-1 ring-slate/10">
                    <div className="space-y-2">
                      <label htmlFor="agenda-date" className="text-sm font-medium text-slate">Wybierz daty</label>
                      <div className="flex gap-2">
                        <input 
                          id="agenda-date" 
                          type="date" 
                          value={currentDateInput} 
                          onChange={e => setCurrentDateInput(e.target.value)} 
                          className="flex-1 rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-slate shadow-sm focus:outline-none focus:ring-2 focus:ring-sage"
                        />
                        <button 
                          type="button" 
                          onClick={addDate}
                          className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate shadow-sm ring-1 ring-inset ring-slate/10 hover:bg-slate/5 transition-colors"
                        >
                          Dodaj
                        </button>
                      </div>
                    </div>
                    {itemDates.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {itemDates.map(d => (
                          <span key={d} className="inline-flex items-center gap-1.5 bg-white border border-slate/10 text-xs font-medium text-slate pl-2.5 pr-1.5 py-1.5 rounded-lg shadow-sm">
                            {new Date(d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                            <button 
                              type="button" 
                              onClick={() => removeDate(d)} 
                              className="text-slate-soft hover:text-rose-600 rounded-md hover:bg-rose-50 p-0.5 transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-rose-600">Wybierz co najmniej jedną datę.</p>
                    )}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={submitting || (!isRecurring && itemDates.length === 0)}
                  className="w-full mt-6 rounded-xl bg-sage px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sage-dark transition-colors disabled:opacity-50 disabled:hover:bg-sage"
                >
                  {submitting ? 'Dodawanie...' : 'Dodaj wpis do harmonogramu'}
                </button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
