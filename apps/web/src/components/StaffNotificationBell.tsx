'use client';

import React from 'react';
import Link from 'next/link';
import { Bell, MessageSquare, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useStaffUnansweredMessages } from '@/hooks/useStaffUnansweredMessages';
import { formatResidentInitials } from '@/lib/messages-helper';
import { Badge } from '@/components/ui/badge';
import { formatPersonName } from '@/lib/person-name'

/**
 * @REQ: FAM-MESSAGES
 * @REQ: NUR-BOARD
 *
 * Dzwonek alertów systemowych i powiadomień w panelu personelu placówki.
 * Informuje o nowych i oczekujących wiadomościach od rodzin.
 */
export function StaffNotificationBell() {
  const { awaitingThreads, unansweredCount } = useStaffUnansweredMessages();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="staff-notifications-bell"
        aria-label="Powiadomienia i wiadomości"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <Bell className="h-4 w-4" />
        {unansweredCount > 0 && (
          <span
            data-testid="staff-notifications-badge"
            className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-sm font-bold text-primary-foreground ring-2 ring-background"
          >
            {unansweredCount > 99 ? '99+' : unansweredCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        data-testid="staff-notifications-dropdown"
        className="w-80 rounded-xl p-2 border border-border"
      >
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0 text-sm font-semibold text-foreground">
            Alerty i wiadomości
          </DropdownMenuLabel>
          {unansweredCount > 0 && (
            <Badge
              data-testid="staff-notifications-count"
              className="h-5 px-1.5 text-sm border-none bg-primary/10 text-primary"
            >
              {unansweredCount} oczekujące
            </Badge>
          )}
        </div>
        <DropdownMenuSeparator />

        {unansweredCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Brak nowych powiadomień</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Wszystkie wiadomości od rodzin zostały obsłużone.
            </p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-1">
            {awaitingThreads.slice(0, 5).map((thread) => {
              const res = thread.lastMessage.residents;
              const initials = formatResidentInitials(res?.first_name, res?.last_name);
              const residentDisplay = res?.first_name && res?.last_name
                ? formatPersonName(res.first_name, res.last_name)
                : `Inicjały: ${initials}`;
              const timeAgo = formatDistanceToNow(new Date(thread.lastMessage.created_at), {
                addSuffix: true,
                locale: pl,
              });
              const snippet = thread.lastMessage.content.length > 70
                ? `${thread.lastMessage.content.slice(0, 67)}...`
                : thread.lastMessage.content;

              return (
                <DropdownMenuItem
                  key={thread.threadId}
                  data-testid={`notification-thread-${thread.residentId}`}
                  render={
                    <Link
                      href={`/admin/messages?residentId=${thread.residentId}`}
                      className="flex flex-col items-start gap-1 p-2.5 rounded-lg cursor-pointer hover:bg-accent/60 transition-colors"
                    />
                  }
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate max-w-[170px]">{residentDisplay}</span>
                    </span>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {timeAgo}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 pl-5">
                    {snippet}
                  </p>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <Link
              href="/admin/messages"
              className="flex w-full items-center justify-center py-2 text-center text-sm font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
            />
          }
        >
          Przejdź do skrzynki wiadomości
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
