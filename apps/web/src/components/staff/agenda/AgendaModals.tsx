'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { AlertCircle, EyeOff } from 'lucide-react'
import { isMedicalAgendaItem } from '@/lib/agenda-family-visibility'
import { AgendaItem, ResidentSummary, ITEM_TYPES } from './agenda-types'
import { formatPersonName } from '@/lib/person-name'

interface AgendaModalsProps {
  editingItem: AgendaItem | null
  onCloseEdit: () => void
  onUpdate: (data: { id: string; title: string; time: string; type: string; resident_id: string | null }) => Promise<boolean>
  deleteItemId: string | null
  onCloseDelete: () => void
  onConfirmDelete: () => Promise<void>
  residents: ResidentSummary[]
}

interface AgendaEditFormProps {
  item: AgendaItem
  onClose: () => void
  onUpdate: (data: { id: string; title: string; time: string; type: string; resident_id: string | null }) => Promise<boolean>
  residents: ResidentSummary[]
}

function AgendaEditForm({ item, onClose, onUpdate, residents }: AgendaEditFormProps) {
  const [editTitle, setEditTitle] = useState(item.title)
  const [editTime, setEditTime] = useState(item.time.slice(0, 5))
  const [editType, setEditType] = useState(item.type)
  const [editResidentId, setEditResidentId] = useState(item.resident_id || '')
  // FAM-AGENDA-NO-MEDICAL: ta sama reguła co baza (family_visible)
  const hiddenFromFamily = isMedicalAgendaItem({ title: editTitle, type: editType })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditError(null)

    if (!editTitle.trim() || !editTime || !editType) {
      setEditError('Wszystkie pola są wymagane.')
      return
    }

    setEditSubmitting(true)
    try {
      const ok = await onUpdate({
        id: item.id,
        title: editTitle.trim(),
        time: editTime,
        type: editType,
        resident_id: editResidentId || null,
      })
      if (ok) onClose()
    } catch {
      setEditError('Błąd połączenia z serwerem.')
    } finally {
      setEditSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="edit-title" className="text-sm font-medium text-foreground">
          Tytuł *
        </label>
        <input
          id="edit-title"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          required
          aria-describedby={hiddenFromFamily ? 'edit-family-hidden-hint' : undefined}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-touch"
        />
        {hiddenFromFamily && (
          <p id="edit-family-hidden-hint" className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Ten wpis nie będzie widoczny dla rodziny (treść medyczna).
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label htmlFor="edit-time" className="text-sm font-medium text-foreground">
            Godzina *
          </label>
          <input
            id="edit-time"
            type="time"
            value={editTime}
            onChange={(e) => setEditTime(e.target.value)}
            required
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-touch"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="edit-type" className="text-sm font-medium text-foreground">
            Typ *
          </label>
          <NativeSelect
            id="edit-type"
            value={editType}
            onChange={(e) => setEditType(e.target.value)}
            className="w-full min-h-touch"
          >
            {ITEM_TYPES.map((t) => (
              <NativeSelectOption key={t.value} value={t.value}>{t.label}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="edit-resident" className="text-sm font-medium text-foreground">
          Przypisanie podopiecznego
        </label>
        <NativeSelect
          id="edit-resident"
          value={editResidentId}
          onChange={(e) => setEditResidentId(e.target.value)}
          className="w-full min-h-touch"
        >
          <NativeSelectOption value="">Wszyscy podopieczni (Cała placówka)</NativeSelectOption>
          {residents.map((r) => (
            <NativeSelectOption key={r.id} value={r.id}>{formatPersonName(r.first_name, r.last_name)}</NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {editError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{editError}</span>
        </div>
      )}

      <DialogFooter className="gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={editSubmitting} className="min-h-touch">
          Anuluj
        </Button>
        <Button type="submit" disabled={editSubmitting} className="min-h-touch">
          {editSubmitting ? 'Zapisywanie...' : 'Zapisz zmiany'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function AgendaModals({
  editingItem,
  onCloseEdit,
  onUpdate,
  deleteItemId,
  onCloseDelete,
  onConfirmDelete,
  residents,
}: AgendaModalsProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onConfirmDelete()
    } finally {
      setIsDeleting(false)
      onCloseDelete()
    }
  }

  return (
    <>
      {editingItem && (
        <Dialog open={Boolean(editingItem)} onOpenChange={(open) => !open && onCloseEdit()}>
          <DialogContent className="sm:max-w-xl md:max-w-2xl p-6">
            <DialogHeader>
              <DialogTitle>Edycja wpisu harmonogramu</DialogTitle>
              <DialogDescription>
                Zaktualizuj szczegóły punktu agendy, czas lub przypisanego podopiecznego.
              </DialogDescription>
            </DialogHeader>

            <AgendaEditForm
              key={editingItem.id}
              item={editingItem}
              onClose={onCloseEdit}
              onUpdate={onUpdate}
              residents={residents}
            />
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={Boolean(deleteItemId)}
        onOpenChange={(open) => !open && onCloseDelete()}
        title="Usuń wpis z harmonogramu"
        description="Czy na pewno chcesz usunąć ten wpis z harmonogramu? Tej operacji nie można cofnąć."
        confirmLabel="Usuń"
        cancelLabel="Anuluj"
        variant="destructive"
        loading={isDeleting}
        onConfirm={handleDelete}
      />
    </>
  )
}
