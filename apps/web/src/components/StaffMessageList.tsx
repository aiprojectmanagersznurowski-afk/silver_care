'use client'

import React from 'react'
import { format, isSameDay } from 'date-fns'
import { pl } from 'date-fns/locale'
import { CheckCircle2 } from 'lucide-react'
import { RawMessage } from '@/lib/messages-helper'

interface StaffMessageListProps {
  messages: RawMessage[]
  scrollRef: React.RefObject<HTMLDivElement | null>
}

export function StaffMessageList({ messages, scrollRef }: StaffMessageListProps) {
  return (
    <div
      ref={scrollRef}
      data-testid="messages-scroll-container"
      className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/50"
    >
      {messages.map((msg, idx) => {
        const isStaff = !msg.is_from_family
        const prev = messages[idx - 1]
        const showDate = !prev || !isSameDay(new Date(msg.created_at), new Date(prev.created_at))

        return (
          <React.Fragment key={msg.id}>
            {showDate && (
              <div className="flex justify-center my-4">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider bg-card px-3 py-1 rounded-full border border-border shadow-2xs">
                  {format(new Date(msg.created_at), 'EEEE, d MMMM yyyy', { locale: pl })}
                </span>
              </div>
            )}

            <div className={`flex flex-col ${isStaff ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[78%] rounded-xl px-4 py-3 ${
                  isStaff
                    ? 'bg-primary text-white rounded-br-xs'
                    : 'bg-card text-foreground border border-border rounded-bl-xs'
                }`}
              >
                <p className="text-sm md:text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </p>
              </div>
              <div className="flex items-center gap-1.5 mt-1 px-1">
                <span className="text-sm text-muted-foreground">
                  {isStaff ? 'Personel placówki' : 'Rodzina / Opiekun'} ·{' '}
                  {format(new Date(msg.created_at), 'HH:mm')}
                </span>
                {isStaff && <CheckCircle2 className="h-3 w-3 text-primary" />}
              </div>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}
