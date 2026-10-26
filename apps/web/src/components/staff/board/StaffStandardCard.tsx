'use client'

import React from 'react'
import Link from 'next/link'
import { Bed, Mic, FileText, MessageSquare } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { MediaUploader } from '@/components/MediaUploader'
import {
  getActiveAssignment,
  getNoteStatus,
  STATUS_CONFIG,
  UnansweredInfo,
} from './staff-board-types'

interface StaffStandardCardProps {
  resident: Record<string, unknown>
  unansweredInfo?: UnansweredInfo
}

export function StaffStandardCard({ resident, unansweredInfo }: StaffStandardCardProps) {
  const resId = resident.id as string
  const active = getActiveAssignment(resident)
  const beds = active?.beds as Record<string, unknown> | undefined
  const rooms = beds?.rooms as Record<string, unknown> | undefined
  const bedLabel = beds?.label as string | undefined
  const roomNumber = rooms?.number as string | undefined
  const noteStatus = getNoteStatus(resident)
  const statusCfg = STATUS_CONFIG[noteStatus]
  const hasUnanswered = Boolean(unansweredInfo?.hasUnanswered)

  return (
    <Card className="group relative overflow-hidden transition-all hover:ring-primary/30 flex flex-col">
      <CardContent className="p-0 flex flex-col h-full">
        <div className="p-5 flex-grow space-y-4">
          <div className="flex items-start justify-between">
            <Avatar className="h-12 w-12 border border-border">
              {(resident.avatar_url as string) && (
                <AvatarImage
                  src={resident.avatar_url as string}
                  alt={`${resident.first_name as string} ${resident.last_name as string}`}
                />
              )}
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {(resident.first_name as string)?.[0]}
                {(resident.last_name as string)?.[0]}
              </AvatarFallback>
            </Avatar>
            <span
              className={`inline-flex items-center rounded-md px-2 py-1 text-sm font-medium ring-1 ring-inset ${statusCfg.className}`}
            >
              {statusCfg.label}
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-foreground truncate">
                <Link href={`/staff/residents/${resId}`} className="hover:text-primary hover:underline">
                  {resident.first_name as string} {resident.last_name as string}
                </Link>
              </h3>
              <BusinessIdBadge type="resident" id={resId} />
            </div>
            <div className="mt-1 flex items-center text-sm text-muted-foreground">
              <Bed className="h-4 w-4 mr-1.5 shrink-0" />
              {roomNumber && bedLabel ? (
                <span>
                  Pokój {roomNumber}, Łóżko {bedLabel}
                </span>
              ) : (
                <span className="text-foreground">Brak przypisanego łóżka</span>
              )}
            </div>
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
        </div>

        <div className="border-t border-border p-4 bg-muted/50 flex flex-col gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/voice?resident=${resId}`}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors min-h-touch"
              >
                <Mic className="h-4 w-4" />
                Nagraj notatkę
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              Otwórz potok głosowy i nagraj obserwację dla pensjonariusza
            </TooltipContent>
          </Tooltip>

          {noteStatus !== 'none' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={`/staff/reports?resident=${resId}`}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm font-medium text-foreground ring-1 ring-inset ring-border hover:bg-muted/50 transition-colors min-h-touch"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Podgląd raportu
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                Zobacz wygenerowany raport i historię obserwacji
              </TooltipContent>
            </Tooltip>
          )}

          <div className="mt-1">
            <MediaUploader residentId={resId} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
