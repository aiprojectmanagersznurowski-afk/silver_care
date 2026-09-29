'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { MapPin, Loader2 } from 'lucide-react'
import { formatAddressSuggestion } from '@/lib/org-helpers'

interface AddressAutocompleteInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  required?: boolean
}

interface PlacePrediction {
  description: string
  place_id: string
}

interface GooglePlacesAutocompleteService {
  getPlacePredictions(
    request: { input: string; types?: string[] },
    callback: (results: PlacePrediction[] | null, status: string) => void
  ): void
}

interface CustomWindow extends Window {
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
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) return

    const scriptId = 'google-maps-places-script'
    if (document.getElementById(scriptId) || (window as unknown as CustomWindow).google?.maps?.places) {
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  }, [])

  const fetchPredictions = async (query: string) => {
    if (!query || query.length < 3) {
      setPredictions([])
      setIsOpen(false)
      return
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      // Fallback: brak klucza Google Maps — tryb ręczny bez błędów
      return
    }

    setIsLoading(true)
    try {
      const customWindow = typeof window !== 'undefined' ? (window as unknown as CustomWindow) : null
      const ServiceClass = customWindow?.google?.maps?.places?.AutocompleteService

      if (ServiceClass) {
        const service = new ServiceClass()
        service.getPlacePredictions(
          { input: query, types: ['address'] },
          (results, status) => {
            setIsLoading(false)
            if (status === 'OK' && results) {
              setPredictions(results.map(r => ({
                description: r.description,
                place_id: r.place_id,
              })))
              setIsOpen(true)
            } else {
              setPredictions([])
              setIsOpen(false)
            }
          }
        )
      } else {
        setIsLoading(false)
      }
    } catch {
      setIsLoading(false)
      setPredictions([])
      setIsOpen(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)
    fetchPredictions(val)
  }

  const handleSelectPrediction = (description: string) => {
    const formatted = formatAddressSuggestion(description)
    onChange(formatted)
    setPredictions([])
    setIsOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={className}
          disabled={disabled}
          required={required}
          autoComplete="off"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-soft">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
      </div>

      {isOpen && predictions.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate/10 bg-white py-1 shadow-lg text-sm text-slate">
          {predictions.map((p) => (
            <li
              key={p.place_id}
              onClick={() => handleSelectPrediction(p.description)}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-sage/10 transition-colors"
            >
              <MapPin className="h-4 w-4 text-sage shrink-0" />
              <span className="truncate">{p.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
