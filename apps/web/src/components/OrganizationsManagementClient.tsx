'use client'

import React from 'react'
import { ViewToggle, GRID_TABLE_OPTIONS } from '@/components/patterns/ViewToggle'
import { OrgViewMode } from '@/lib/org-helpers'

/** Placówki zapisują tryb kafelków jako „cards” (zgodność z zapamiętanymi preferencjami). */
const ORG_VIEW_OPTIONS = [GRID_TABLE_OPTIONS[0], { ...GRID_TABLE_OPTIONS[1], value: 'cards' }] as const
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
    'table',
    ['table', 'cards'] as const
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
        <ViewToggle value={viewMode} onChange={setViewMode} options={ORG_VIEW_OPTIONS} />

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
