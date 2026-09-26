'use client'

import React, { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface PhotoGalleryModalProps {
  images: string[]
  initialIndex?: number
  isOpen: boolean
  onClose: () => void
}

export function PhotoGalleryModal({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
}: PhotoGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  useEffect(() => {
    setCurrentIndex(initialIndex)
  }, [initialIndex, isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, images.length, onClose])

  if (!isOpen || images.length === 0) return null

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Podgląd zdjęcia"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-4xl w-full flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Controls */}
        <div className="w-full flex items-center justify-between text-white/90 pb-3">
          <span className="text-sm font-medium">
            Zdjęcie {currentIndex + 1} z {images.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij podgląd"
            className="rounded-full bg-white/10 hover:bg-white/20 p-2 text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main Image Container */}
        <div className="relative flex items-center justify-center w-full max-h-[75vh] overflow-hidden rounded-2xl bg-black/40">
          <img
            src={images[currentIndex]}
            alt={`Zdjęcie ${currentIndex + 1}`}
            className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl select-none"
          />

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Poprzednie zdjęcie"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/75 p-3 text-white transition-all shadow-md"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Następne zdjęcie"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/75 p-3 text-white transition-all shadow-md"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
