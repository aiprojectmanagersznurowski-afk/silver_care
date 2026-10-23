'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'

export interface EditResidentFormData {
  first_name: string
  last_name: string
  gender: string
  birth_date: string
  admission_date: string
  care_level: string
  is_zsn: boolean
  notes: string
}

interface EditResidentFormFieldsProps {
  formData: EditResidentFormData
  setFormData: React.Dispatch<React.SetStateAction<EditResidentFormData>>
}

export function EditResidentFormFields({ formData, setFormData }: EditResidentFormFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="edit-first-name" className="text-sm font-medium text-foreground">
            Imię *
          </Label>
          <Input
            id="edit-first-name"
            value={formData.first_name}
            onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
            className="min-h-touch"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-last-name" className="text-sm font-medium text-foreground">
            Nazwisko *
          </Label>
          <Input
            id="edit-last-name"
            value={formData.last_name}
            onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
            className="min-h-touch"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="edit-gender" className="text-sm font-medium text-foreground">
            Płeć
          </Label>
          <NativeSelect
            id="edit-gender"
            value={formData.gender}
            onChange={(e) => setFormData((prev) => ({ ...prev, gender: e.target.value }))}
            className="w-full min-h-touch"
          >
            <NativeSelectOption value="">Nieokreślona</NativeSelectOption>
            <NativeSelectOption value="F">Kobieta</NativeSelectOption>
            <NativeSelectOption value="M">Mężczyzna</NativeSelectOption>
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-birth-date" className="text-sm font-medium text-foreground">
            Data urodzenia
          </Label>
          <Input
            id="edit-birth-date"
            type="date"
            value={formData.birth_date}
            onChange={(e) => setFormData((prev) => ({ ...prev, birth_date: e.target.value }))}
            className="min-h-touch"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-admission-date" className="text-sm font-medium text-foreground">
            Data przyjęcia
          </Label>
          <Input
            id="edit-admission-date"
            type="date"
            value={formData.admission_date}
            onChange={(e) => setFormData((prev) => ({ ...prev, admission_date: e.target.value }))}
            className="min-h-touch"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="edit-care-level" className="text-sm font-medium text-foreground">
            Poziom opieki
          </Label>
          <NativeSelect
            id="edit-care-level"
            value={formData.care_level}
            onChange={(e) => setFormData((prev) => ({ ...prev, care_level: e.target.value }))}
            className="w-full min-h-touch"
          >
            <NativeSelectOption value="">Nieokreślony</NativeSelectOption>
            <NativeSelectOption value="walking">Chodzący</NativeSelectOption>
            <NativeSelectOption value="sitting">Siedzący</NativeSelectOption>
            <NativeSelectOption value="bedridden">Leżący</NativeSelectOption>
            <NativeSelectOption value="hospice">Opieka paliatywna</NativeSelectOption>
          </NativeSelect>
        </div>

        <div className="space-y-1.5 flex flex-col justify-end">
          <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 cursor-pointer min-h-touch">
            <input
              type="checkbox"
              id="edit-is-zsn"
              checked={formData.is_zsn}
              onChange={(e) => setFormData((prev) => ({ ...prev, is_zsn: e.target.checked }))}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-foreground">
              ZSN: Znaczny stopień niepełnosprawności
            </span>
          </label>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="edit-notes" className="text-sm font-medium text-foreground">
          Notatki / uwagi organizacyjne
        </Label>
        <Textarea
          id="edit-notes"
          value={formData.notes}
          onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
          rows={3}
          className="w-full"
          placeholder="Wpisz istotne informacje organizacyjne..."
        />
      </div>
    </>
  )
}
