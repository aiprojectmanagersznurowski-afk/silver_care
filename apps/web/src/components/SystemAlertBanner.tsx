'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Info, AlertOctagon, Wrench, X } from 'lucide-react'
import {
  getActiveSystemBannerState,
  type ActiveSystemBannerState,
  type SystemAlertRecord,
} from '@/lib/system-status-helpers'
import { getSystemAlertsAction } from '@/actions/system-status'

interface SystemAlertBannerProps {
  role?: string
  initialAlerts?: SystemAlertRecord[]
}

export function SystemAlertBanner({ role, initialAlerts }: SystemAlertBannerProps) {
  const [activeAlert, setActiveAlert] = useState<ActiveSystemBannerState | null>(() =>
    initialAlerts ? getActiveSystemBannerState(initialAlerts) : null
  )
  const [dismissedId, setDismissedId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadAlerts() {
      const res = await getSystemAlertsAction()
      if (isMounted && res.alerts) {
        setActiveAlert(getActiveSystemBannerState(res.alerts))
      }
    }

    if (!initialAlerts) {
      loadAlerts()
    }

    const handleUpdate = () => {
      loadAlerts()
    }
    window.addEventListener('system-alert-updated', handleUpdate)

    // Odświeżanie stanu co 60 sekund
    const interval = setInterval(loadAlerts, 60000)
    return () => {
      isMounted = false
      clearInterval(interval)
      window.removeEventListener('system-alert-updated', handleUpdate)
    }
  }, [initialAlerts])

  if (!activeAlert || dismissedId === activeAlert.id) {
    return null
  }

  const isSuperAdmin = role === 'super_admin'

  const severityStyles = {
    error: {
      wrapper: 'bg-destructive/15 text-foreground border-destructive/30',
      icon: <AlertOctagon className="h-5 w-5 shrink-0 text-destructive" />,
      badge: 'bg-destructive text-destructive-foreground',
      label: 'Awaria usługi',
    },
    warning: {
      wrapper: 'bg-amber-500/15 text-foreground border-amber-500/30',
      icon: <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />,
      badge: 'bg-amber-600 text-white dark:bg-amber-500',
      label: 'Prace serwisowe / Utrudnienia',
    },
    info: {
      wrapper: 'bg-primary/10 text-foreground border-primary/25',
      icon: <Info className="h-5 w-5 shrink-0 text-primary" />,
      badge: 'bg-primary text-primary-foreground',
      label: 'Informacja techniczna',
    },
  }[activeAlert.severity]

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="global-system-alert-banner"
      className={`border-b px-4 py-3 sm:px-6 transition-all duration-200 ${severityStyles.wrapper}`}
    >
      <div className="mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 max-w-screen-2xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{severityStyles.icon}</div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-sm font-semibold px-2 py-0.5 rounded-md ${severityStyles.badge}`}>
                {severityStyles.label}
              </span>
              <strong className="text-base font-semibold text-foreground tracking-tight">
                {activeAlert.title}
              </strong>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {activeAlert.message}
            </p>
            {activeAlert.serviceLabels.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Wrench className="h-3.5 w-3.5" /> Dotyczy:
                </span>
                {activeAlert.serviceLabels.map((serviceLabel) => (
                  <span
                    key={serviceLabel}
                    className="inline-flex items-center text-sm px-2 py-0.5 rounded-full bg-background/80 border border-border text-foreground font-medium"
                  >
                    {serviceLabel}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center shrink-0">
          {isSuperAdmin && (
            <Link
              href="/admin/system-status"
              className="inline-flex items-center justify-center text-sm font-semibold px-3 py-2 rounded-lg bg-background hover:bg-muted border border-border text-foreground transition-colors min-h-11"
            >
              Zarządzaj alertem &rarr;
            </Link>
          )}
          <button
            type="button"
            onClick={() => setDismissedId(activeAlert.id)}
            aria-label="Ukryj powiadomienie na tę sesję"
            className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors min-h-11 min-w-11"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
