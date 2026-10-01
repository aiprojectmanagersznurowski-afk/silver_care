'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { 
  CalendarX, 
  X, 
  Trash2, 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  Pencil, 
  Users, 
  Sunrise, 
  Sun, 
  Sunset, 
  Moon,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
const toast = {
  success: (msg: string) => console.log('[SUCCESS]', msg),
  error: (msg: string) => console.error('[ERROR]', msg),
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface AgendaItem {
  id: string
  title: string
  time: string
  type: string
  resident_id: string | null
  target_date: string | null
}

interface ResidentSummary {
  id: string
  first_name: string
  last_name: string
}

type TimeSlotKey = 'morning' | 'noon' | 'afternoon' | 'evening'

interface SlotDefinition {
  key: TimeSlotKey
  label: string
  timeRange: string
  icon: typeof Sunrise
  startHour: number
  endHour: number
}

const TIME_SLOTS: SlotDefinition[] = [
  { key: 'morning', label: 'Rano', timeRange: '06:00 – 11:59', icon: Sunrise, startHour: 6, endHour: 11 },
  { key: 'noon', label: 'Południe', timeRange: '12:00 – 14:59', icon: Sun, startHour: 12, endHour: 14 },
  { key: 'afternoon', label: 'Popołudnie', timeRange: '15:00 – 17:59', icon: Sunset, startHour: 15, endHour: 17 },
  { key: 'evening', label: 'Wieczór i noc', timeRange: '18:00 – 05:59', icon: Moon, startHour: 18, endHour: 23 },
]

const ITEM_TYPES = [
  { value: 'meal', label: 'Posiłek' },
  { value: 'activity', label: 'Aktywność i integracja' },
  { value: 'therapy', label: 'Terapia zajęciowa' },
  { value: 'hygiene', label: 'Higiena i toaleta' },
  { value: 'rest', label: 'Odpoczynek' },
  { value: 'other', label: 'Inne' },
]

function getItemSlot(timeStr: string): TimeSlotKey {
  const hour = parseInt(timeStr.split(':')[0], 10)
  if (isNaN(hour)) return 'morning'
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 15) return 'noon'
  if (hour >= 15 && hour < 18) return 'afternoon'
  return 'evening'
}

function isCurrentSlot(slot: SlotDefinition): boolean {
  const nowHour = new Date().getHours()
  if (slot.key === 'evening') {
    return nowHour >= 18 || nowHour < 6
  }
  return nowHour >= slot.startHour && nowHour <= slot.endHour
}

export default function StaffAgendaPage() {
  const [items, setItems] = useState<AgendaItem[]>([])
  const [residents, setResidents] = useState<ResidentSummary[]>([])
  const [loading, setLoading] = useState(true)

  // Wyświetlana data
  const [viewDate, setViewDate] = useState(new Date().toISOString().slice(0, 10))

  // Stan formularza tworzenia nowego wpisu
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [type, setType] = useState('meal')
  const [selectedResidentId, setSelectedResidentId] = useState('')
  const [isRecurring, setIsRecurring] = useState(true)
  const [itemDates, setItemDates] = useState<string[]>([new Date().toISOString().slice(0, 10)])
  const [currentDateInput, setCurrentDateInput] = useState(new Date().toISOString().slice(0, 10))
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Stan modala edycji wpisu
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editType, setEditType] = useState('meal')
  const [editResidentId, setEditResidentId] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/staff/agenda?date=${viewDate}`)
      const data = await res.json()
      setItems(data.items || [])
    } catch {
      toast.error('Nie udało się pobrać harmonogramu.')
    } finally {
      setLoading(false)
    }
  }

  const fetchResidents = async () => {
    try {
      const res = await fetch('/api/residents')
      const data = await res.json()
      if (data.residents) {
        setResidents(data.residents)
      }
    } catch {
      console.error('Nie udało się pobrać listy podopiecznych.')
    }
  }

  useEffect(() => {
    fetchItems()
  }, [viewDate])

  useEffect(() => {
    fetchResidents()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!title.trim() || !time || !type) {
      setFormError('Wypełnij wszystkie wymagane pola.')
      return
    }
    if (!isRecurring && itemDates.length === 0) {
      setFormError('Wybierz przynajmniej jedną datę.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/staff/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: title.trim(), 
          time, 
          type, 
          resident_id: selectedResidentId || null,
          target_dates: isRecurring ? [] : itemDates 
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Wystąpił błąd zapisu.')
        return
      }

      toast.success('Dodano wpis do harmonogramu.')
      setTitle('')
      setTime('')
      setType('meal')
      setSelectedResidentId('')
      setItemDates([new Date().toISOString().slice(0, 10)])
      fetchItems()
    } catch {
      setFormError('Błąd połączenia z serwerem.')
    } finally {
      setSubmitting(false)
    }
  }

  const openEditModal = (item: AgendaItem) => {
    setEditingItem(item)
    setEditTitle(item.title)
    setEditTime(item.time.slice(0, 5))
    setEditType(item.type)
    setEditResidentId(item.resident_id || '')
    setEditError(null)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return
    setEditError(null)

    if (!editTitle.trim() || !editTime || !editType) {
      setEditError('Wszystkie pola są wymagane.')
      return
    }

    setEditSubmitting(true)
    try {
      const res = await fetch('/api/staff/agenda', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingItem.id,
          title: editTitle.trim(),
          time: editTime,
          type: editType,
          resident_id: editResidentId || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setEditError(data.error || 'Nie udało się zaktualizować wpisu.')
        return
      }

      toast.success('Zaktualizowano wpis.')
      setEditingItem(null)
      fetchItems()
    } catch {
      setEditError('Błąd połączenia z serwerem.')
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten wpis z harmonogramu?')) return
    try {
      const res = await fetch(`/api/staff/agenda?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Usunięto wpis.')
        fetchItems()
      } else {
        toast.error('Nie udało się usunąć wpisu.')
      }
    } catch {
      toast.error('Błąd połączenia z serwerem.')
    }
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
        <h2 className="text-3xl font-display font-semibold tracking-tight text-slate">Agenda na dziś</h2>
        <p className="mt-2 text-slate-soft">
          Planer dnia placówki podzielony na pory dnia. Zarządzaj zadaniami ogólnymi i dedykowanymi podopiecznym.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Harmonogram po lewej (2 kolumny) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate/5 bg-white overflow-hidden">
            <div className="p-6 border-b border-slate/5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate/5">
              <div>
                <h3 className="text-lg font-semibold text-slate flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-sage-dark" />
                  Harmonogram dnia
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
                  className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate shadow-sm ring-1 ring-inset ring-slate/10 hover:bg-slate/5 transition-colors min-h-[40px]"
                >
                  Dziś
                </button>
              </div>
            </div>

            <CardContent className="p-6 space-y-8">
              {loading ? (
                <div className="py-12 text-center text-sm font-medium text-slate-soft">
                  Ładowanie harmonogramu...
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate/5 text-slate-soft mb-4">
                    <CalendarX className="h-8 w-8" />
                  </div>
                  <p className="text-base font-semibold text-slate">Brak wpisów na ten dzień.</p>
                  <p className="text-sm mt-1 text-slate-soft text-center max-w-sm">
                    Dodaj nowy punkt harmonogramu za pomocą formularza po prawej stronie.
                  </p>
                </div>
              ) : (
                /* Podział na pory dnia */
                <div className="space-y-6">
                  {TIME_SLOTS.map((slot) => {
                    const slotItems = items.filter(it => getItemSlot(it.time) === slot.key)
                    const isNow = isCurrentSlot(slot) && viewDate === new Date().toISOString().slice(0, 10)
                    const IconComp = slot.icon

                    return (
                      <div
                        key={slot.key}
                        data-slot={slot.key}
                        className={`rounded-2xl border p-5 transition-all ${
                          isNow
                            ? 'bg-sage/5 border-sage/40 ring-1 ring-sage/20 shadow-xs'
                            : 'bg-white border-slate/10 hover:border-slate/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-xl ${isNow ? 'bg-sage text-white' : 'bg-slate/5 text-slate-soft'}`}>
                              <IconComp className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-slate text-base">{slot.label}</h4>
                                {isNow && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-sage/20 px-2 py-0.5 text-[11px] font-bold text-sage-dark uppercase tracking-wide">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Teraz
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-soft">{slot.timeRange}</p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-slate-soft bg-slate/5 px-2.5 py-1 rounded-full">
                            Wpisów: {slotItems.length}
                          </span>
                        </div>

                        {slotItems.length === 0 ? (
                          <div className="py-4 text-center text-xs font-medium text-slate-soft bg-slate/5 rounded-xl border border-dashed border-slate/10">
                            Brak zaplanowanych zadań na tę porę dnia.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {slotItems.map((item) => {
                              const resident = item.resident_id
                                ? residents.find(r => r.id === item.resident_id)
                                : null

                              return (
                                <div
                                  key={item.id}
                                  className="group flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate/10 hover:border-slate/20 hover:shadow-xs transition-all"
                                >
                                  <div className="flex items-start gap-3.5">
                                    <div className="flex items-center justify-center rounded-lg bg-slate/5 text-slate font-bold text-sm px-2.5 py-1.5 shrink-0 mt-0.5">
                                      {item.time.slice(0, 5)}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h5 className="font-semibold text-slate text-sm">{item.title}</h5>
                                        {!item.target_date && (
                                          <span className="inline-flex items-center rounded-md bg-slate/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-soft">
                                            Codziennie
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-soft">
                                        <span className="font-medium text-slate">
                                          {ITEM_TYPES.find(t => t.value === item.type)?.label || item.type}
                                        </span>
                                        <span>·</span>
                                        {resident ? (
                                          <span className="inline-flex items-center gap-1 font-medium text-sage-dark bg-sage/10 px-2 py-0.5 rounded-md">
                                            <Users className="h-3 w-3" />
                                            {resident.first_name} {resident.last_name}
                                          </span>
                                        ) : (
                                          <span className="text-slate-soft">Cała placówka (ogólne)</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(item)}
                                      className="p-2 text-slate-soft hover:text-sage-dark hover:bg-sage/10 rounded-lg transition-colors"
                                      title="Edytuj wpis"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(item.id)}
                                      className="p-2 text-slate-soft hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                      title="Usuń wpis"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Formularz dodawania po prawej (1 kolumna) */}
        <div className="space-y-6">
          <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate/5 bg-white">
            <div className="p-6 border-b border-slate/5">
              <h3 className="text-lg font-semibold text-slate flex items-center gap-2">
                <Plus className="h-5 w-5 text-sage-dark" />
                Nowy wpis w agendzie
              </h3>
            </div>
            <CardContent className="p-6">
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="agenda-title" className="text-sm font-medium text-slate">
                    Tytuł wydarzenia *
                  </label>
                  <input 
                    id="agenda-title" 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    placeholder="Np. Podwieczorek i herbata" 
                    required 
                    className="w-full rounded-xl border border-slate/20 bg-white px-3.5 py-2.5 text-sm text-slate shadow-xs focus:outline-none focus:ring-2 focus:ring-sage"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label htmlFor="agenda-time" className="text-sm font-medium text-slate flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-soft" /> Godzina *
                    </label>
                    <input 
                      id="agenda-time" 
                      type="time" 
                      value={time} 
                      onChange={e => setTime(e.target.value)} 
                      required 
                      className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-slate shadow-xs focus:outline-none focus:ring-2 focus:ring-sage"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="agenda-type" className="text-sm font-medium text-slate">
                      Typ *
                    </label>
                    <select 
                      id="agenda-type" 
                      value={type} 
                      onChange={e => setType(e.target.value)} 
                      className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-slate shadow-xs focus:outline-none focus:ring-2 focus:ring-sage"
                    >
                      {ITEM_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Przypisanie podopiecznego */}
                <div className="space-y-2">
                  <label htmlFor="agenda-resident" className="text-sm font-medium text-slate flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-slate-soft" /> Przypisanie
                  </label>
                  <select
                    id="agenda-resident"
                    value={selectedResidentId}
                    onChange={e => setSelectedResidentId(e.target.value)}
                    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2.5 text-sm text-slate shadow-xs focus:outline-none focus:ring-2 focus:ring-sage"
                  >
                    <option value="">Wszyscy podopieczni (Cała placówka)</option>
                    {residents.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.first_name} {r.last_name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-soft">
                    Możesz zaplanować zadanie ogólne lub skierowane do konkretnego pensjonariusza.
                  </p>
                </div>
                
                {/* Częstotliwość */}
                <div className="pt-3 border-t border-slate/10">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-soft mb-2.5 block">
                    Częstotliwość
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsRecurring(true)}
                      className={`flex flex-col items-center justify-center rounded-xl p-3 text-center transition-all ${
                        isRecurring ? 'bg-sage/10 ring-2 ring-sage-dark' : 'bg-slate/5 ring-1 ring-slate/10 hover:bg-slate/10'
                      }`}
                    >
                      <span className={`text-xs font-semibold ${isRecurring ? 'text-sage-dark' : 'text-slate'}`}>
                        Codziennie
                      </span>
                      <span className="text-[10px] text-slate-soft mt-0.5">Wszystkie dni</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRecurring(false)}
                      className={`flex flex-col items-center justify-center rounded-xl p-3 text-center transition-all ${
                        !isRecurring ? 'bg-sage/10 ring-2 ring-sage-dark' : 'bg-slate/5 ring-1 ring-slate/10 hover:bg-slate/10'
                      }`}
                    >
                      <span className={`text-xs font-semibold ${!isRecurring ? 'text-sage-dark' : 'text-slate'}`}>
                        Jednorazowo
                      </span>
                      <span className="text-[10px] text-slate-soft mt-0.5">Wybrane daty</span>
                    </button>
                  </div>
                </div>

                {!isRecurring && (
                  <div className="space-y-3 bg-slate/5 p-3.5 rounded-2xl ring-1 ring-slate/10">
                    <label htmlFor="agenda-date" className="text-xs font-medium text-slate">
                      Wybierz daty
                    </label>
                    <div className="flex gap-2">
                      <input 
                        id="agenda-date" 
                        type="date" 
                        value={currentDateInput} 
                        onChange={e => setCurrentDateInput(e.target.value)} 
                        className="flex-1 rounded-xl border border-slate/20 bg-white px-3 py-1.5 text-xs text-slate shadow-xs focus:outline-none focus:ring-2 focus:ring-sage"
                      />
                      <button 
                        type="button" 
                        onClick={addDate}
                        className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate shadow-xs ring-1 ring-inset ring-slate/10 hover:bg-slate/5 transition-colors"
                      >
                        Dodaj
                      </button>
                    </div>
                    {itemDates.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {itemDates.map(d => (
                          <span key={d} className="inline-flex items-center gap-1 bg-white border border-slate/10 text-xs font-medium text-slate pl-2 pr-1 py-1 rounded-lg shadow-xs">
                            {new Date(d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                            <button 
                              type="button" 
                              onClick={() => removeDate(d)} 
                              className="text-slate-soft hover:text-rose-600 rounded-md p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-rose-600">Wybierz co najmniej jedną datę.</p>
                    )}
                  </div>
                )}

                {formError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={submitting || (!isRecurring && itemDates.length === 0)}
                  className="w-full mt-4 rounded-xl bg-sage px-4 py-3 text-sm font-semibold text-white shadow-xs hover:bg-sage-dark transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  {submitting ? 'Dodawanie...' : 'Dodaj wpis do harmonogramu'}
                </button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal edycji wpisu agendy */}
      {editingItem && (
        <Dialog open={Boolean(editingItem)} onOpenChange={(open) => !open && setEditingItem(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edycja wpisu harmonogramu</DialogTitle>
              <DialogDescription>
                Zaktualizuj szczegóły punktu agendy, czas lub przypisanego podopiecznego.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="edit-title" className="text-sm font-medium text-slate">
                  Tytuł *
                </label>
                <input
                  id="edit-title"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-slate shadow-xs focus:outline-none focus:ring-2 focus:ring-sage"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label htmlFor="edit-time" className="text-sm font-medium text-slate">
                    Godzina *
                  </label>
                  <input
                    id="edit-time"
                    type="time"
                    value={editTime}
                    onChange={e => setEditTime(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-slate shadow-xs focus:outline-none focus:ring-2 focus:ring-sage"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="edit-type" className="text-sm font-medium text-slate">
                    Typ *
                  </label>
                  <select
                    id="edit-type"
                    value={editType}
                    onChange={e => setEditType(e.target.value)}
                    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-slate shadow-xs focus:outline-none focus:ring-2 focus:ring-sage"
                  >
                    {ITEM_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="edit-resident" className="text-sm font-medium text-slate">
                  Przypisanie podopiecznego
                </label>
                <select
                  id="edit-resident"
                  value={editResidentId}
                  onChange={e => setEditResidentId(e.target.value)}
                  className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-slate shadow-xs focus:outline-none focus:ring-2 focus:ring-sage"
                >
                  <option value="">Wszyscy podopieczni (Cała placówka)</option>
                  {residents.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.first_name} {r.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {editError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingItem(null)}
                  disabled={editSubmitting}
                >
                  Anuluj
                </Button>
                <Button
                  type="submit"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? 'Zapisywanie...' : 'Zapisz zmiany'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
