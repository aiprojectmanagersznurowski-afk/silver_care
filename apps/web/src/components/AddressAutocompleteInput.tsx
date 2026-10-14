'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { MapPin, Loader2 } from 'lucide-react'
import { formatAddressSuggestion } from '@/lib/org-helpers'
import { cn } from '@/lib/utils'

/**
 * @REQ: ORG-PROVISION
 *
 * Komponent autouzupełniania adresu placówki zintegrowany z Google Places API.
 * Wykorzystuje proxy endpoint /api/places/autocomplete z fallbackiem do Google Maps JS SDK.
 * Zapewnia pełną obsługę klawiatury (ArrowUp, ArrowDown, Enter, Escape) oraz
 * poprawne wyświetlanie ponad elementami modali (z-[100]).
 */

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

export interface PlacePrediction {
  place_id: string
  description: string
  main_text?: string
  secondary_text?: string
}

interface GoogleMapsPlacesPrediction {
  place_id: string
  description: string
  structured_formatting?: {
    main_text?: string
    secondary_text?: string
  }
}

interface GooglePlacesAutocompleteService {
  getPlacePredictions(
    request: {
      input: string
      types?: string[]
      componentRestrictions?: { country: string }
    },
    callback: (results: GoogleMapsPlacesPrediction[] | null, status: string) => void
  ): void
}

interface WindowWithGoogle extends Window {
  google?: {
    maps?: {
      places?: {
        AutocompleteService?: new () => GooglePlacesAutocompleteService
      }
    }
  }
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
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number>(-1)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

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
  }, [])

  // Czyszczenie timerów i zapytań sieciowych przy odmontowaniu
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

  const fetchPredictions = useCallback(async (query: string) => {
    if (!query || query.trim().length < 3) {
      setPredictions([])
      setIsOpen(false)
      setIsLoading(false)
      setActiveIndex(-1)
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsLoading(true)

    try {
      // 1. Priorytetowe zapytanie do serwerowego proxy Google Places
      const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(query.trim())}`, {
        signal: controller.signal
      })

      if (res.ok) {
        const data = await res.json()
        const items: PlacePrediction[] = data.predictions || []

        if (items.length > 0) {
          setPredictions(items)
          setIsOpen(true)
          setActiveIndex(-1)
          setIsLoading(false)
          return
        }
      }

      // 2. Fallback do klienta Google Maps JS SDK (jeśli załadowany w window)
      const gWindow = typeof window !== 'undefined' ? (window as unknown as WindowWithGoogle) : null
      const ServiceClass = gWindow?.google?.maps?.places?.AutocompleteService

      if (ServiceClass) {
        const service = new ServiceClass()
        service.getPlacePredictions(
          {
            input: query.trim(),
            types: ['address'],
            componentRestrictions: { country: 'pl' }
          },
          (results: GoogleMapsPlacesPrediction[] | null, status: string) => {
            setIsLoading(false)
            if (status === 'OK' && results && results.length > 0) {
              setPredictions(
                results.map((r) => ({
                  place_id: r.place_id,
                  description: r.description,
                  main_text: r.structured_formatting?.main_text || r.description,
                  secondary_text: r.structured_formatting?.secondary_text || ''
                }))
              )
              setIsOpen(true)
              setActiveIndex(-1)
            } else {
              setPredictions([])
              setIsOpen(false)
            }
          }
        )
      } else {
        setIsLoading(false)
        setPredictions([])
        setIsOpen(false)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setIsLoading(false)
        setPredictions([])
        setIsOpen(false)
      }
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchPredictions(val)
    }, 250)
  }

  const handleSelectPrediction = (prediction: PlacePrediction) => {
    const formatted = formatAddressSuggestion(prediction.description)
    onChange(formatted)
    setPredictions([])
    setIsOpen(false)
    setActiveIndex(-1)
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

      {isOpen && predictions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-[100] mt-1 max-h-60 overflow-auto rounded-xl border border-border bg-popover/95 backdrop-blur-sm p-1.5 shadow-xl text-sm text-popover-foreground transition-all duration-100 ease-out"
        >
          {predictions.map((p, idx) => {
            const isActive = idx === activeIndex
            return (
              <li
                key={p.place_id || idx}
                role="option"
                aria-selected={isActive}
                onMouseDown={(e) => {
                  e.preventDefault() // zapobiega blur inputa przed wykonaniem wyboru
                  handleSelectPrediction(p)
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  'flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                  isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
                )}
              >
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-xs sm:text-sm truncate">
                    {p.main_text || p.description}
                  </span>
                  {p.secondary_text && (
                    <span className="text-[11px] text-muted-foreground truncate">
                      {p.secondary_text}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
