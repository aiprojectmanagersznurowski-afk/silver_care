'use client'

import React, { useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { formatAddressSuggestion } from '@/lib/org-helpers'
import { cn } from '@/lib/utils'
import {
  AddressPredictionDropdown,
  type PlacePrediction,
} from '@/components/address/AddressPredictionDropdown'
import { useAddressPredictions } from '@/components/address/useAddressPredictions'

export type { PlacePrediction }

export interface AddressAutocompleteInputProps {
  id?: string
  name?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  required?: boolean
}

export function AddressAutocompleteInput({
  id,
  name,
  value,
  onChange,
  placeholder = 'np. ul. Leśna 10, 00-001 Warszawa',
  className,
  disabled,
  required,
}: AddressAutocompleteInputProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)

  const {
    predictions,
    isOpen,
    setIsOpen,
    isLoading,
    activeIndex,
    setActiveIndex,
    triggerDebouncedFetch,
    clearPredictions,
  } = useAddressPredictions()

  // Zamknięcie listy podpowiedzi po kliknięciu na zewnątrz
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setIsOpen, setActiveIndex])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)
    triggerDebouncedFetch(val)
  }

  const handleSelectPrediction = (prediction: PlacePrediction) => {
    const formatted = formatAddressSuggestion(prediction.description)
    onChange(formatted)
    clearPredictions()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || predictions.length === 0) {
      if (e.key === 'ArrowDown' && predictions.length > 0) {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev < predictions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : predictions.length - 1))
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < predictions.length) {
        e.preventDefault()
        handleSelectPrediction(predictions[activeIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <Input
          id={id}
          name={name}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (predictions.length > 0) {
              setIsOpen(true)
            }
          }}
          placeholder={placeholder}
          className={cn('pr-9', className)}
          disabled={disabled}
          required={required}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}
      </div>

      <AddressPredictionDropdown
        isOpen={isOpen}
        predictions={predictions}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
        onSelect={handleSelectPrediction}
      />
    </div>
  )
}
