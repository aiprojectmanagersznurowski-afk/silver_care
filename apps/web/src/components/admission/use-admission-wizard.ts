'use client'

import { useState } from 'react'
import { parseNationalId, BedSuggestion } from '@/lib/admission-helpers'
import { getBedSuggestionsAction, admitResidentAction } from '@/actions/admission'
import type { CareLevelType, WizardStep } from './admission-types'

export function useAdmissionWizard() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<WizardStep>(1)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [idValue, setIdValue] = useState('')
  const [careLevel, setCareLevel] = useState<CareLevelType>('walking')
  const [isZsn, setIsZsn] = useState(false)
  const [notes, setNotes] = useState('')

  const [calculatedGender, setCalculatedGender] = useState<'M' | 'F' | null>(null)
  const [calculatedBirthDate, setCalculatedBirthDate] = useState<string | null>(null)
  const [idError, setIdError] = useState<string | null>(null)

  const [suggestions, setSuggestions] = useState<BedSuggestion[]>([])
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null)
  const [selectedBedInfo, setSelectedBedInfo] = useState<string | null>(null)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [createdResidentId, setCreatedResidentId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  // ADM-CAPACITY-LIMIT: ostrzeżenie o przekroczeniu limitu miejsc i świadome potwierdzenie
  const [capacityWarning, setCapacityWarning] = useState<string | null>(null)
  const [capacityConfirmed, setCapacityConfirmed] = useState(false)

  const handleIdChange = (val: string) => {
    setIdValue(val)
    if (val.length === 11) {
      const parsed = parseNationalId(val)
      if (parsed.valid && parsed.gender && parsed.birthDate) {
        setCalculatedGender(parsed.gender)
        setCalculatedBirthDate(parsed.birthDate)
        setIdError(null)
      } else {
        setCalculatedGender(null)
        setCalculatedBirthDate(null)
        setIdError(parsed.error || 'Nieprawidłowy identyfikator.')
      }
    } else {
      setCalculatedGender(null)
      setCalculatedBirthDate(null)
      setIdError(val.length > 0 ? 'Wprowadź pełne 11 cyfr.' : null)
    }
  }

  const handleFetchSuggestions = async () => {
    if (!calculatedGender) return
    setLoadingSuggestions(true)
    setStatusMessage(null)

    const res = await getBedSuggestionsAction(calculatedGender, careLevel)
    setLoadingSuggestions(false)

    if (res.error) {
      setStatusMessage({ type: 'error', text: res.error })
    } else if (res.suggestions) {
      setSuggestions(res.suggestions)
      if (res.suggestions.length > 0 && !selectedBedId) {
        setSelectedBedId(res.suggestions[0].bedId)
        setSelectedBedInfo(`Pokój ${res.suggestions[0].roomNumber} (piętro ${res.suggestions[0].floorNumber}), Łóżko ${res.suggestions[0].bedNumber}`)
      }
    }
  }

  const handleNextToStep2 = async () => {
    if (!firstName.trim() || !lastName.trim() || !calculatedGender) {
      setStatusMessage({ type: 'error', text: 'Uzupełnij wszystkie wymagane pola identyfikacyjne.' })
      return
    }
    setStatusMessage(null)
    setStep(2)
    await handleFetchSuggestions()
  }

  const resetForm = () => {
    setStep(1)
    setFirstName('')
    setLastName('')
    setIdValue('')
    setCareLevel('walking')
    setIsZsn(false)
    setNotes('')
    setCalculatedGender(null)
    setCalculatedBirthDate(null)
    setIdError(null)
    setSuggestions([])
    setSelectedBedId(null)
    setSelectedBedInfo(null)
    setStatusMessage(null)
    setCreatedResidentId(null)
    setCapacityWarning(null)
    setCapacityConfirmed(false)
  }

  const handleSubmitAdmission = async () => {
    setSubmitting(true)
    setStatusMessage(null)

    const formData = new FormData()
    formData.append('firstName', firstName.trim())
    formData.append('lastName', lastName.trim())
    formData.append('nationalId', idValue.trim())
    formData.append('careLevel', careLevel)
    formData.append('isZsn', isZsn ? 'true' : 'false')
    if (selectedBedId) formData.append('bedId', selectedBedId)
    if (notes.trim()) formData.append('notes', notes.trim())
    if (capacityConfirmed) formData.append('confirmCapacityExceed', 'true')

    const res = await admitResidentAction(formData)
    setSubmitting(false)

    if (res.capacityWarning) {
      setCapacityWarning(res.capacityWarning)
    } else if (res.error) {
      setStatusMessage({ type: 'error', text: res.error })
    } else {
      setCreatedResidentId(res.residentId || null)
      setStatusMessage({ type: 'success', text: res.message || 'Przyjęcie zakończone pomyślnie.' })
    }
  }

  return {
    open, setOpen,
    step, setStep,
    firstName, setFirstName,
    lastName, setLastName,
    idValue, handleIdChange,
    careLevel, setCareLevel,
    isZsn, setIsZsn,
    notes, setNotes,
    calculatedGender, calculatedBirthDate, idError,
    suggestions, selectedBedId, setSelectedBedId,
    selectedBedInfo, setSelectedBedInfo, loadingSuggestions,
    handleFetchSuggestions, handleNextToStep2,
    submitting, createdResidentId, statusMessage, setStatusMessage,
    capacityWarning, capacityConfirmed, setCapacityConfirmed,
    resetForm, handleSubmitAdmission,
  }
}
