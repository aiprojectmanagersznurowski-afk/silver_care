'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'

export interface ResidentEditSheetFormData {
  first_name: string
  last_name: string
  birth_date: string
  admission_date: string
  care_level: string
  notes: string
}

interface ResidentEditSheetFormFieldsProps {
  formData: ResidentEditSheetFormData
  setFormData: React.Dispatch<React.SetStateAction<ResidentEditSheetFormData>>
}

export function ResidentEditSheetFormFields({
  formData,
  setFormData,
}: ResidentEditSheetFormFieldsProps) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="first_name" className="text-sm font-medium text-foreground">
          Imię *
        </Label>
        <Input
          id="first_name"
          value={formData.first_name}
          onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
          className="min-h-touch"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="last_name" className="text-sm font-medium text-foreground">
          Nazwisko *
        </Label>
        <Input
          id="last_name"
          value={formData.last_name}
          onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
          className="min-h-touch"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="birth_date" className="text-sm font-medium text-foreground">
            Data urodzenia
          </Label>
          <Input
            id="birth_date"
            type="date"
            value={formData.birth_date}
            onChange={(e) => setFormData((prev) => ({ ...prev, birth_date: e.target.value }))}
            className="min-h-touch"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="admission_date" className="text-sm font-medium text-foreground">
            Data przyjęcia
          </Label>
          <Input
            id="admission_date"
            type="date"
            value={formData.admission_date}
            onChange={(e) => setFormData((prev) => ({ ...prev, admission_date: e.target.value }))}
            className="min-h-touch"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="care_level" className="text-sm font-medium text-foreground">
          Poziom opieki
        </Label>
        <NativeSelect
          id="care_level"
          value={formData.care_level}
          onChange={(e) => setFormData((prev) => ({ ...prev, care_level: e.target.value }))}
          className="w-full"
        >
          <NativeSelectOption value="">Nieokreślony</NativeSelectOption>
          <NativeSelectOption value="walking">Chodzący</NativeSelectOption>
          <NativeSelectOption value="sitting">Siedzący</NativeSelectOption>
          <NativeSelectOption value="bedridden">Leżący</NativeSelectOption>
          <NativeSelectOption value="hospice">Opieka paliatywna</NativeSelectOption>
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-sm font-medium text-foreground">
          Notatki / uwagi organizacyjne
        </Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
          rows={4}
          className="w-full"
          placeholder="Wpisz istotne informacje organizacyjne..."
        />
      </div>
    </>
  )
}
