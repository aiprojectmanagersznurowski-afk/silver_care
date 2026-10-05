'use client'

import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { formatBusinessId, BusinessEntityType } from '@/lib/business-ids'
import { toast } from 'sonner'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

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
    toast.success(`Skopiowano identyfikator ${businessId} do schowka`)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <span
      data-slot="business-id-badge"
      title={`Techniczny UUID: ${id}`}
      className={`inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1 text-xs font-mono font-medium text-foreground border border-border transition-colors hover:bg-muted ${className}`}
    >
      <span>{businessId}</span>
      {showCopy && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="button"
              tabIndex={0}
              aria-label="Kopiuj identyfikator"
              onClick={handleCopy}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  handleCopy(e as unknown as React.MouseEvent)
                }
              }}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded cursor-pointer inline-flex items-center"
            >
              {copied ? (
                <Check className="h-3 w-3 text-primary" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {copied ? 'Skopiowano!' : `Kopiuj ${businessId} do schowka`}
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  )
}
