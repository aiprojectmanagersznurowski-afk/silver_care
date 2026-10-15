import { useState, useRef, useEffect, useCallback } from 'react'
import type { PlacePrediction } from './AddressPredictionDropdown'

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

export function useAddressPredictions() {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number>(-1)

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

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
        signal: controller.signal,
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
            componentRestrictions: { country: 'pl' },
          },
          (results: GoogleMapsPlacesPrediction[] | null, status: string) => {
            setIsLoading(false)
            if (status === 'OK' && results && results.length > 0) {
              setPredictions(
                results.map((r) => ({
                  place_id: r.place_id,
                  description: r.description,
                  main_text: r.structured_formatting?.main_text || r.description,
                  secondary_text: r.structured_formatting?.secondary_text || '',
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

  const triggerDebouncedFetch = (val: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchPredictions(val)
    }, 250)
  }

  const clearPredictions = () => {
    setPredictions([])
    setIsOpen(false)
    setActiveIndex(-1)
  }

  return {
    predictions,
    setPredictions,
    isOpen,
    setIsOpen,
    isLoading,
    activeIndex,
    setActiveIndex,
    triggerDebouncedFetch,
    clearPredictions,
  }
}
