'use client'

import React from 'react'
import { LayoutGrid, Table as TableIcon } from 'lucide-react'
import { OrgViewMode } from '@/lib/org-helpers'
import { useViewPreference, VIEW_PREFERENCE_KEYS } from '@/hooks/use-view-preference'
import {
  OrganizationsLoadingState,
  OrganizationsErrorState,
  OrganizationsEmptyState
} from './organizations/OrganizationsFeedbackStates'
import { OrganizationsTableView } from './organizations/OrganizationsTableView'
import { OrganizationsCardsView } from './organizations/OrganizationsCardsView'
import {
  OrganizationSummaryItem,
  OrganizationsManagementClientProps
} from './organizations/organizations-types'

export type { OrganizationSummaryItem }

export function OrganizationsManagementClient({
  initialOrganizations,
  errorMessage,
  forcedState,
  renderActionSlot
}: OrganizationsManagementClientProps) {
  const organizations = initialOrganizations
  const [viewMode, setViewMode] = useViewPreference<OrgViewMode>(
    VIEW_PREFERENCE_KEYS.organizations,
    'cards',
    ['cards', 'table'] as const
  )

  const currentState = forcedState || (errorMessage ? 'error' : organizations.length === 0 ? 'empty' : 'success')

  if (currentState === 'loading') {
    return <OrganizationsLoadingState />
  }

  if (currentState === 'error') {
    return <OrganizationsErrorState errorMessage={errorMessage} />
  }

  if (currentState === 'empty') {
    return <OrganizationsEmptyState renderActionSlot={renderActionSlot} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 min-w-0 flex-1">
        {/* View mode toggle */}
        <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border">
          <button
            type="button"
            aria-label="Widok kafelków"
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'cards'
                ? 'bg-card text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            <span>Kafelki</span>
          </button>
          <button
            type="button"
            aria-label="Widok tabeli"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-card text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <TableIcon className="h-4 w-4" />
            <span>Tabela</span>
          </button>
        </div>

        {renderActionSlot && <div className="shrink-0">{renderActionSlot}</div>}
      </div>

      {viewMode === 'table' ? (
        <OrganizationsTableView organizations={organizations} />
      ) : (
        <OrganizationsCardsView organizations={organizations} />
      )}
    </div>
  )
}
