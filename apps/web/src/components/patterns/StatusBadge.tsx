import type { ComponentProps } from 'react'

export type StatusTone = 'neutral' | 'brand'

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-muted text-foreground',
  brand: 'bg-primary/10 text-primary',
}

interface StatusBadgeProps extends Omit<ComponentProps<'span'>, 'className'> {
  tone?: StatusTone
}

/**
 * Wspólna plakietka statusu (ADR-017 pkt 3): jeden kształt, dwa tony — neutralny i kolor marki.
 * Bez tonu ostrzegawczego i bez czerwieni; nie przyjmuje className, więc kolor nie da się nadpisać.
 */
export function StatusBadge({ tone = 'neutral', children, ...props }: StatusBadgeProps) {
  return (
    <span
      {...props}
      data-slot="status-badge"
      data-tone={tone}
      className={`inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-sm font-medium [&>svg]:size-3.5 [&>svg]:shrink-0 ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  )
}
