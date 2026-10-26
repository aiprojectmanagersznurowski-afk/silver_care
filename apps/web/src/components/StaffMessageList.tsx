'use client'

import React from 'react'
import { format, isSameDay } from 'date-fns'
import { pl } from 'date-fns/locale'
import { CheckCircle2 } from 'lucide-react'
import { RawMessage } from '@/lib/messages-helper'
import { ChatBubble, ChatDateSeparator, CHAT_SCROLL_AREA } from './patterns/Chat'

interface StaffMessageListProps {
  messages: RawMessage[]
  scrollRef: React.RefObject<HTMLDivElement | null>
  /** Kto z bliskich pisze w tym wątku (rola z kontraktu) */
  familyLabel?: string
}

export function StaffMessageList({ messages, scrollRef, familyLabel = 'Rodzina / Opiekun' }: StaffMessageListProps) {
  return (
    <div
      ref={scrollRef}
      data-testid="messages-scroll-container"
      className={`flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-2 ${CHAT_SCROLL_AREA}`}
    >
      {messages.map((msg, idx) => {
        const isStaff = !msg.is_from_family
        const prev = messages[idx - 1]
        const showDate = !prev || !isSameDay(new Date(msg.created_at), new Date(prev.created_at))

        return (
          <React.Fragment key={msg.id}>
            {showDate && (
              <ChatDateSeparator>{format(new Date(msg.created_at), 'EEEE, d MMMM yyyy', { locale: pl })}</ChatDateSeparator>
            )}
            <ChatBubble
              own={isStaff}
              meta={<>
                {isStaff ? 'Personel placówki' : familyLabel} · {format(new Date(msg.created_at), 'HH:mm')}
                {isStaff && <CheckCircle2 className="size-3 text-primary" />}
              </>}
            >
              {msg.content}
            </ChatBubble>
          </React.Fragment>
        )
      })}
    </div>
  )
}
