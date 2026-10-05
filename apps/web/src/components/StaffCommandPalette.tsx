'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Mic, FileText, X, Command, User } from 'lucide-react'

interface ResidentItem {
  id: string
  first_name: string
  last_name: string
  room_number?: string | null
}

interface StaffCommandPaletteProps {
  residents?: ResidentItem[]
}

export function StaffCommandPalette({ residents = [] }: StaffCommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [cachedResidents, setCachedResidents] = useState<ResidentItem[]>(residents)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Pobierz listę podopiecznych jeśli nie przekazano w propsach
  useEffect(() => {
    if (residents.length > 0) {
      setCachedResidents(residents)
      return
    }
    async function load() {
      try {
        const res = await fetch('/api/residents')
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) {
            setCachedResidents(
              data.map((r: { id: string; first_name: string; last_name: string }) => ({
                id: r.id,
                first_name: r.first_name,
                last_name: r.last_name,
              }))
            )
          }
        }
      } catch {
        // Cichy fallback
      }
    }
    load()
  }, [residents])

  // Nasłuchiwanie skrótu Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const filtered = useMemo(() => {
    if (!query.trim()) return cachedResidents.slice(0, 8)
    const q = query.toLowerCase().trim()
    return cachedResidents
      .filter((r) => `${r.first_name} ${r.last_name}`.toLowerCase().includes(q))
      .slice(0, 8)
  }, [cachedResidents, query])

  const handleSelectVoice = (residentId: string) => {
    setIsOpen(false)
    router.push(`/voice?resident=${residentId}`)
  }

  const handleSelectReports = (residentId: string) => {
    setIsOpen(false)
    router.push(`/staff/reports?resident=${residentId}`)
  }

  const handleKeyDownList = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        handleSelectVoice(filtered[selectedIndex].id)
      }
    }
  }

  return (
    <>
      {/* Przycisk wyzwalacza w nagłówku lub pasku bocznym */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-card/80 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-colors min-h-[44px]"
        title="Otwórz paletę poleceń (Cmd+K)"
        aria-label="Otwórz szybkie polecenia i wyszukiwanie pensjonariuszy"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline">Szybkie polecenia</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </button>

      {/* Modal Command Palette */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
          <div
            className="fixed inset-0 bg-foreground/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Paleta szybkiego wyboru podopiecznego"
            className="relative w-full max-w-lg rounded-xl bg-card shadow-2xl ring-1 ring-foreground/10 overflow-hidden flex flex-col z-10 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Input wyszukiwania */}
            <div className="flex items-center border-b border-border px-4">
              <Search className="h-5 w-5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Wpisz imię podopiecznego, aby podyktować notatkę..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelectedIndex(0)
                }}
                onKeyDown={handleKeyDownList}
                className="w-full px-3 py-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none bg-transparent"
              />
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Wyniki */}
            <div className="max-h-80 overflow-y-auto p-2 divide-y divide-border">
              {filtered.length > 0 ? (
                filtered.map((resident, idx) => {
                  const isSelected = idx === selectedIndex
                  return (
                    <div
                      key={resident.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl transition-colors min-h-[48px] ${
                        isSelected ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/50 text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-foreground shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold">
                            {resident.first_name} {resident.last_name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Enter: Dyktuj notatkę głosową
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSelectVoice(resident.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors min-h-[40px]"
                          title="Dyktuj nową notatkę"
                        >
                          <Mic className="h-3.5 w-3.5" />
                          Dyktuj
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectReports(resident.id)}
                          className="px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted text-foreground text-xs font-medium inline-flex items-center gap-1 transition-colors min-h-[40px]"
                          title="Przejdź do raportów"
                        >
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          Raporty
                        </button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nie znaleziono podopiecznego pasującego do frazy &quot;{query}&quot;.
                </div>
              )}
            </div>

            {/* Stopka z instrukcją klawiszy */}
            <div className="border-t border-border px-4 py-2.5 bg-muted/50 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Nawigacja: ↑ ↓ strzałki | Wybierz: Enter</span>
              <span>Zamknij: Esc</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
