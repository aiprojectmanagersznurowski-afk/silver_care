import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { pl } from 'date-fns/locale'
import { Bell, MessageSquare } from 'lucide-react'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu'
import { StatusBadge } from '@/components/patterns/StatusBadge'

interface ReplyItem {
  id: string
  created_at: string
  content: string
}

interface FamilyNotificationsDropdownContentProps {
  unreadCount: number
  recentReplies: ReplyItem[]
  markAllAsRead: () => void
}

export function FamilyNotificationsDropdownContent({
  unreadCount,
  recentReplies,
  markAllAsRead,
}: FamilyNotificationsDropdownContentProps) {
  return (
    <DropdownMenuContent
      align="end"
      data-testid="family-notifications-dropdown"
      className="w-80 rounded-xl p-2 border border-border"
    >
      <div className="flex items-center justify-between px-2 py-1.5">
        <DropdownMenuLabel className="p-0 text-sm font-semibold text-foreground">
          Powiadomienia
        </DropdownMenuLabel>
        {unreadCount > 0 && (
          <StatusBadge tone="brand" data-testid="family-notifications-count">
            {unreadCount} nowe
          </StatusBadge>
        )}
      </div>
      <DropdownMenuSeparator />

      {unreadCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Brak nowych powiadomień</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Jesteś na bieżąco ze wszystkimi wiadomościami.
          </p>
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto space-y-1">
          {recentReplies.map((reply) => {
            const timeAgo = formatDistanceToNow(new Date(reply.created_at), {
              addSuffix: true,
              locale: pl,
            })
            const snippet =
              reply.content.length > 70 ? `${reply.content.slice(0, 67)}...` : reply.content

            return (
              <DropdownMenuItem
                key={reply.id}
                data-testid={`family-notification-item-${reply.id}`}
                render={
                  <Link
                    href="/messages"
                    onClick={() => markAllAsRead()}
                    className="flex flex-col items-start gap-1 p-2.5 rounded-lg cursor-pointer hover:bg-accent/60 transition-colors"
                  />
                }
              >
                <div className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Wiadomość od personelu</span>
                  </span>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {timeAgo}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 pl-5">
                  {snippet}
                </p>
              </DropdownMenuItem>
            )
          })}
        </div>
      )}

      <DropdownMenuSeparator />
      <DropdownMenuItem
        render={
          <Link
            href="/messages"
            onClick={() => markAllAsRead()}
            className="flex w-full items-center justify-center py-2 text-center text-sm font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
          />
        }
      >
        Przejdź do wiadomości
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}
