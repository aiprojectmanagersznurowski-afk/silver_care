import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  width?: number
  height?: number
  priority?: boolean
  alt?: string
}

/**
 * Komponent Logo Silver Care z automatycznym przełączaniem motywu:
 * - W trybie jasnym (light mode): /logo.png
 * - W trybie ciemnym (dark mode): /logo-dark.png
 */
export function Logo({
  className,
  width = 160,
  height = 44,
  priority = false,
  alt = 'Silver Care',
}: LogoProps) {
  return (
    <>
      <Image
        src="/logo.png"
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={cn('dark:hidden', className)}
      />
      <Image
        src="/logo-dark.png"
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={cn('hidden dark:block', className)}
      />
    </>
  )
}
