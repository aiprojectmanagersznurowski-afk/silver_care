import * as React from "react"

const MOBILE_BREAKPOINT = 768

/** Czy ekran jest węższy niż `breakpoint` px. Na serwerze zawsze false (widok szeroki). */
export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT) {
  const subscribe = React.useCallback((callback: () => void) => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    mql.addEventListener("change", callback)
    return () => mql.removeEventListener("change", callback)
  }, [breakpoint])

  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < breakpoint,
    () => false
  )
}
