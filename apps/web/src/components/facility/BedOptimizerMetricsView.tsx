'use client'

import React from 'react'
import type { FacilityAllocationMetrics } from '@/lib/bed-allocation-optimizer'

interface BedOptimizerMetricsViewProps {
  metrics: FacilityAllocationMetrics
}

export function BedOptimizerMetricsView({ metrics }: BedOptimizerMetricsViewProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="p-3 bg-muted rounded-xl border border-border">
        <p className="text-sm text-muted-foreground">Wskaźnik jakości</p>
        <p className="text-xl font-bold text-foreground">
          {metrics.overallScore}%
        </p>
      </div>

      <div className="p-3 bg-muted rounded-xl border border-border">
        <p className="text-sm text-muted-foreground">Konflikty płci</p>
        <p className="text-xl font-bold text-foreground">
          {metrics.genderConflictsCount}
        </p>
      </div>

      <div className="p-3 bg-muted rounded-xl border border-border">
        <p className="text-sm text-muted-foreground">Bariery mobilności</p>
        <p className="text-xl font-bold text-foreground">
          {metrics.mobilityMismatchCount}
        </p>
      </div>

      <div className="p-3 bg-muted rounded-xl border border-border">
        <p className="text-sm text-muted-foreground">Wolne łóżka</p>
        <p className="text-xl font-bold text-foreground">{metrics.freeBeds}</p>
      </div>
    </div>
  )
}
