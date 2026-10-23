'use client'

import React from 'react'
import Link from 'next/link'
import { Bed, CheckCircle2, Mic, Loader2, MessageSquare } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { getActiveAssignment, UnansweredInfo } from './staff-board-types'

interface StaffQuickRoundsCardProps {
  resident: Record<string, unknown>
  isLogged: boolean
  isSubmitting: boolean
  unansweredInfo?: UnansweredInfo
  onQuickLog: (residentId: string) => void
}

export function StaffQuickRoundsCard({
  resident,
  isLogged,
  isSubmitting,
  unansweredInfo,
  onQuickLog,
}: StaffQuickRoundsCardProps) {
  const resId = resident.id as string
  const active = getActiveAssignment(resident)
  const beds = active?.beds as Record<string, unknown> | undefined
  const rooms = beds?.rooms as Record<string, unknown> | undefined
  const bedLabel = beds?.label as string | undefined
  const roomNumber = rooms?.number as string | undefined
  const hasUnanswered = Boolean(unansweredInfo?.hasUnanswered)

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4 hover:border-primary/40 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border border-border">
            {(resident.avatar_url as string) && (
              <AvatarImage
                src={resident.avatar_url as string}
                alt={`${resident.first_name as string} ${resident.last_name as string}`}
              />
            )}
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-base">
              {(resident.first_name as string)?.[0]}
              {(resident.last_name as string)?.[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h4 className="font-semibold text-foreground text-base">
              {resident.first_name as string} {resident.last_name as string}
            </h4>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <Bed className="h-3.5 w-3.5" />
              {roomNumber && bedLabel
                ? `Pokój ${roomNumber}, Łóżko ${bedLabel}`
                : 'Brak przypisanego łóżka'}
            </p>
          </div>
        </div>

        {isLogged && (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground bg-muted px-2.5 py-1 rounded-full border border-border">
            <CheckCircle2 className="h-3.5 w-3.5 text-foreground" />
            Odnotowano
          </span>
        )}
      </div>

      {hasUnanswered && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-between rounded-lg bg-muted/60 border border-border px-3 py-1.5 text-sm hover:border-primary/40 transition-colors cursor-help">
              <span
                data-testid="unanswered-message-badge"
                className="inline-flex items-center gap-1.5 font-medium text-foreground"
              >
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                Nowa wiadomość od rodziny
              </span>
              <Link
                href={`/admin/messages?residentId=${resId}`}
                className="font-semibold text-primary hover:underline text-sm"
                onClick={(e) => e.stopPropagation()}
              >
                Odpowiedz &rarr;
              </Link>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" align="center" className="max-w-xs p-3 space-y-1.5 bg-popover text-popover-foreground border border-border">
            <div className="flex items-center justify-between text-sm font-semibold text-primary">
              <span>Wiadomość od bliskich</span>
              {unansweredInfo?.lastMessageAt && (
                <span className="text-muted-foreground font-normal">
                  {new Date(unansweredInfo.lastMessageAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <p className="text-sm italic text-foreground leading-snug">
              &ldquo;{unansweredInfo?.lastMessageSnippet || 'Nowa wiadomość oczekująca na odpowiedź.'}&rdquo;
            </p>
            <div className="pt-1 text-sm text-muted-foreground flex justify-between items-center border-t border-border/50">
              <span>{unansweredInfo?.unansweredCount ? `${unansweredInfo.unansweredCount} oczekująca(e)` : 'Wymaga odpowiedzi'}</span>
              <span className="text-primary font-medium">Kliknij &bdquo;Odpowiedz&rdquo;</span>
            </div>
          </TooltipContent>
        </Tooltip>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={`/voice?resident=${resId}`}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors min-h-touch"
            >
              <Mic className="h-4 w-4" />
              Dyktuj (1-klik)
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            Nagraj notatkę głosową dla tego pensjonariusza
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <button
                type="button"
                onClick={() => onQuickLog(resId)}
                disabled={isSubmitting || isLogged}
                className={`w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-sm font-semibold transition-colors min-h-touch ${
                  isLogged
                    ? 'bg-muted text-foreground border border-border cursor-default'
                    : 'bg-card border border-border text-foreground hover:bg-muted/50'
                }`}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : isLogged ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-foreground" />
                    Stabilny
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    Stan stabilny
                  </>
                )}
              </button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {isLogged
              ? 'Obserwacja została już zarejestrowana podczas tego obchodu'
              : 'Zapisz rutynową obserwację: Stan stabilny, bez uwag'}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
