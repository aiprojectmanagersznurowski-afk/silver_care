'use client'

import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { formatBusinessId, BusinessEntityType } from '@/lib/business-ids'

interface BusinessIdBadgeProps {
  type: BusinessEntityType
  id: string
  sequenceNumber?: number
  className?: string
  showCopy?: boolean
}

export function BusinessIdBadge({
  type,
  id,
  sequenceNumber,
  className = '',
  showCopy = true,
}: BusinessIdBadgeProps) {
  const [copied, setCopied] = useState(false)
  const businessId = formatBusinessId(type, id, sequenceNumber)

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(businessId).catch(() => {})
      }
    } catch {
      // Graceful fallback for non-secure / restricted environments
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <span
      data-slot="business-id-badge"
      title={`Techniczny UUID: ${id}`}
      className={`inline-flex items-center gap-1.5 rounded-lg bg-slate/5 px-2 py-1 text-xs font-mono font-medium text-slate border border-slate/10 shadow-xs transition-colors hover:bg-slate/10 ${className}`}
    >
      <span>{businessId}</span>
      {showCopy && (
        <button
          type="button"
          aria-label="Kopiuj identyfikator"
          onClick={handleCopy}
          className="text-slate-soft hover:text-slate transition-colors p-0.5 rounded cursor-pointer"
        >
          {copied ? (
            <Check className="h-3 w-3 text-sage" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      )}
    </span>
  )
}
