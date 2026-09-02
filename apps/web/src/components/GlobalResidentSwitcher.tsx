'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Resident {
  id: string
  first_name: string
  last_name: string
}

function getCookie(name: string) {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift()
  return null
}

function setCookie(name: string, value: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${value}; path=/; max-age=31536000`
}

export function GlobalResidentSwitcher({ residents }: { residents: Resident[] }) {
  const router = useRouter()
  
  // Read initial from cookie or default to first
  const [selectedId, setSelectedId] = useState<string>(() => {
    const cookieVal = getCookie('family_resident_id')
    if (cookieVal && residents.find(r => r.id === cookieVal)) {
      return cookieVal
    }
    return residents[0]?.id || ''
  })

  useEffect(() => {
    // Ensure the cookie is set on mount if it was missing
    if (selectedId && getCookie('family_resident_id') !== selectedId) {
      setCookie('family_resident_id', selectedId)
      router.refresh()
    }
  }, [selectedId, router])

  if (residents.length <= 1) return null

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setCookie('family_resident_id', id)
    router.refresh() // Force server components to re-fetch with new cookie
  }

  return (
    <div className="flex flex-wrap gap-2 py-3 px-4 bg-surface-sunken border-b border-border" role="tablist" aria-label="Wybierz podopiecznego">
      {residents.map((r) => (
        <button
          key={r.id}
          role="tab"
          aria-selected={r.id === selectedId}
          onClick={() => handleSelect(r.id)}
          className={`
            inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all
            ${r.id === selectedId
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-surface text-text-secondary hover:bg-surface-hover border border-border'
            }
          `}
        >
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${r.id === selectedId ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}>
            {r.first_name[0]}{r.last_name[0]}
          </span>
          {r.first_name} {r.last_name}
        </button>
      ))}
    </div>
  )
}
