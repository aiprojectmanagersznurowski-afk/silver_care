'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { AgendaItem, ResidentSummary } from '@/components/staff/agenda/agenda-types'
import { AgendaTimelineSection } from '@/components/staff/agenda/AgendaTimelineSection'
import { AgendaAddForm } from '@/components/staff/agenda/AgendaAddForm'
import { AgendaModals } from '@/components/staff/agenda/AgendaModals'
import { PageHeader } from '@/components/patterns/PageHeader'

export default function StaffAgendaPage() {
  const [items, setItems] = useState<AgendaItem[]>([])
  const [residents, setResidents] = useState<ResidentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [viewDate, setViewDate] = useState(new Date().toISOString().slice(0, 10))

  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null)
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
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
  }, [viewDate])

  const fetchResidents = useCallback(async () => {
    try {
      const res = await fetch('/api/residents')
      const data = await res.json()
      if (data.residents) {
        setResidents(data.residents)
      }
    } catch {
      console.error('Nie udało się pobrać listy podopiecznych.')
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => fetchItems())
  }, [fetchItems])

  useEffect(() => {
    void Promise.resolve().then(() => fetchResidents())
  }, [fetchResidents])

  const handleAdd = async (payload: {
    title: string
    time: string
    type: string
    resident_id: string | null
    target_dates: string[]
  }): Promise<boolean> => {
    try {
      const res = await fetch('/api/staff/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Wystąpił błąd zapisu.')
        return false
      }
      toast.success('Wydarzenie zostało dodane do harmonogramu.')
      fetchItems()
      return true
    } catch {
      toast.error('Błąd połączenia z serwerem.')
      return false
    }
  }

  const handleUpdate = async (payload: {
    id: string
    title: string
    time: string
    type: string
    resident_id: string | null
  }): Promise<boolean> => {
    try {
      const res = await fetch('/api/staff/agenda', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Nie udało się zaktualizować wpisu.')
        return false
      }
      toast.success('Zaktualizowano wpis w harmonogramie.')
      fetchItems()
      return true
    } catch {
      toast.error('Błąd połączenia z serwerem.')
      return false
    }
  }

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteItemId) return
    try {
      const res = await fetch(`/api/staff/agenda?id=${deleteItemId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Usunięto wpis z harmonogramu.')
        fetchItems()
      } else {
        toast.error('Nie udało się usunąć wpisu.')
      }
    } catch {
      toast.error('Błąd połączenia z serwerem.')
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agenda na dziś"
        description="Planer dnia placówki podzielony na pory dnia. Zarządzaj zadaniami ogólnymi i dedykowanymi podopiecznym."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <AgendaTimelineSection
            items={items}
            residents={residents}
            loading={loading}
            viewDate={viewDate}
            onViewDateChange={setViewDate}
            onOpenEdit={(item) => setEditingItem(item)}
            onOpenDelete={(id) => setDeleteItemId(id)}
          />
        </div>

        <div className="space-y-6">
          <AgendaAddForm residents={residents} onAdd={handleAdd} />
        </div>
      </div>

      <AgendaModals
        editingItem={editingItem}
        onCloseEdit={() => setEditingItem(null)}
        onUpdate={handleUpdate}
        deleteItemId={deleteItemId}
        onCloseDelete={() => setDeleteItemId(null)}
        onConfirmDelete={handleConfirmDelete}
        residents={residents}
      />
    </div>
  )
}
